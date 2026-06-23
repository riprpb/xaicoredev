import { randomUUID } from 'node:crypto';
import type { KernelAuditWriter } from '@/platform/audit/contracts';
import type { KernelEventPublisher } from '@/platform/events/contracts';
import type {
  KernelComponentPort,
  KernelGateway,
  KernelOperationRequest,
  KernelOperationResult,
  KernelReadRequest,
} from '@/platform/kernel/contracts';
import { toPermissionRequest } from '@/platform/kernel/contracts';
import type { KernelPermissionEngine, PermissionDecision } from '@/platform/permissions/contracts';

export class DefaultKernelGateway implements KernelGateway {
  private readonly ports = new Map<string, KernelComponentPort>();

  constructor(
    private readonly permissions: KernelPermissionEngine,
    private readonly audit: KernelAuditWriter,
    private readonly events: KernelEventPublisher,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = randomUUID
  ) {}

  register(port: KernelComponentPort): void {
    if (!port.componentId.trim() || port.capabilities.length === 0) {
      throw new Error('Kernel component registration is invalid');
    }
    if (this.ports.has(port.componentId)) {
      throw new Error('Kernel component is already registered');
    }
    this.ports.set(port.componentId, port);
  }

  read<TResult = unknown>(request: KernelReadRequest): Promise<KernelOperationResult<TResult>> {
    return this.execute<Readonly<Record<string, string | number | boolean>>, TResult>({
      ...request,
      payload: request.query,
    });
  }

  async execute<TPayload = unknown, TResult = unknown>(
    request: KernelOperationRequest<TPayload>
  ): Promise<KernelOperationResult<TResult>> {
    await this.publish('kernel.operation.requested', request, {
      target: request.target,
      action: request.action,
      capability: request.capability,
    });
    const permission = await this.permissions.evaluate(
      request.context,
      toPermissionRequest(request)
    );
    await this.publish('kernel.permission.evaluated', request, {
      decisionId: permission.decisionId,
      effect: permission.effect,
    });
    if (permission.effect !== 'allow') return this.result(request, permission, false);

    const port = this.ports.get(request.target);
    if (!port || !port.capabilities.includes(request.capability)) {
      await this.recordOperation(request, permission, 'failed', 'Kernel target is unavailable');
      return this.result<TResult>(request, permission, false, undefined, 'Operation unavailable');
    }
    try {
      const value = await port.handle<TResult>(request);
      await this.recordOperation(request, permission, 'succeeded', operationReason(request));
      await this.publish('kernel.operation.succeeded', request, {
        target: request.target,
        action: request.action,
      });
      return this.result(request, permission, true, value);
    } catch (error) {
      await this.recordOperation(request, permission, 'failed', operationReason(request));
      await this.publish('kernel.operation.failed', request, {
        target: request.target,
        action: request.action,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      return this.result<TResult>(request, permission, false, undefined, 'Operation failed');
    }
  }

  private result<TResult>(
    request: KernelOperationRequest | KernelReadRequest,
    permission: PermissionDecision,
    accepted: boolean,
    result?: TResult,
    message?: string
  ): KernelOperationResult<TResult> {
    return {
      requestId: request.context.requestId,
      correlationId: request.context.correlationId,
      accepted,
      permission,
      result,
      message,
    };
  }

  private async recordOperation(
    request: KernelOperationRequest,
    permission: PermissionDecision,
    outcome: 'succeeded' | 'failed',
    reason: string
  ): Promise<void> {
    await this.audit.append({
      id: this.createId(),
      type: `kernel.operation.${outcome}`,
      action: request.action,
      target: request.target,
      outcome,
      reason,
      occurredAt: this.now().toISOString(),
      context: request.context,
      constitutionalAuthority: permission.constitutionalAuthority,
      permissionDecisionId: permission.decisionId,
      details: { capability: request.capability },
    });
  }

  private async publish(
    type: string,
    request: KernelOperationRequest | KernelReadRequest,
    payload: Readonly<Record<string, unknown>>
  ): Promise<void> {
    await this.events.publish({
      id: this.createId(),
      type,
      source: 'system.kernel',
      occurredAt: this.now().toISOString(),
      context: request.context,
      payload,
    });
  }
}

function operationReason(request: KernelOperationRequest): string {
  if (request.payload && typeof request.payload === 'object') {
    const reason = (request.payload as Record<string, unknown>).reason;
    if (typeof reason === 'string' && reason.trim()) return reason;
  }
  return 'Kernel operation completed under explicit policy';
}
