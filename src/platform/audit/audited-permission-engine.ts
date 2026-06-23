import { randomUUID } from 'node:crypto';
import type { KernelAuditWriter } from '@/platform/audit/contracts';
import type { KernelRequestContext } from '@/platform/kernel/context';
import type {
  KernelPermissionEngine,
  PermissionDecision,
  PermissionRequest,
} from '@/platform/permissions/contracts';

export class AuditedPermissionEngine implements KernelPermissionEngine {
  constructor(
    private readonly delegate: KernelPermissionEngine,
    private readonly audit: KernelAuditWriter,
    private readonly createId: () => string = randomUUID
  ) {}

  async evaluate(
    context: KernelRequestContext,
    request: PermissionRequest
  ): Promise<PermissionDecision> {
    const decision = await this.delegate.evaluate(context, request);
    await this.audit.append({
      id: this.createId(),
      type: 'kernel.permission.evaluated',
      action: request.action,
      target: request.resource,
      outcome: decision.effect === 'allow' ? 'allowed' : 'denied',
      reason: decision.reason,
      occurredAt: decision.decidedAt,
      context,
      constitutionalAuthority: decision.constitutionalAuthority,
      permissionDecisionId: decision.decisionId,
      details: {
        policyVersion: decision.policyVersion,
        capability: readCapability(request),
        targetId: request.targetId,
      },
    });
    return decision;
  }
}

function readCapability(request: PermissionRequest): string | undefined {
  const capability = request.attributes?.capability;
  return typeof capability === 'string' ? capability : undefined;
}
