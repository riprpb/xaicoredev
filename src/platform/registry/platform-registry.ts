import type { Prisma } from '@prisma/client';
import type { DatabaseTransactionRunner } from '@/database/contracts';
import type { KernelComponentPort, KernelOperationRequest } from '@/platform/kernel/contracts';
import type { PlatformLifecycleState } from '@/platform/lifecycle/contracts';
import type { ComponentManifest } from '@/platform/manifests/contracts';
import { validateComponentManifest } from '@/platform/manifests/validation';

export type PlatformRegistrationStatus = 'registered' | 'disabled' | 'removed';

export interface PlatformRegistrationRecord {
  id: string;
  componentId: string;
  manifest: ComponentManifest;
  status: PlatformRegistrationStatus;
  lifecycleState: PlatformLifecycleState;
  executionEnabled: boolean;
  reason: string;
  registeredAt: string;
  updatedAt: string;
  removedAt?: string;
}

export interface PlatformRegistryRepository {
  register(
    manifest: ComponentManifest,
    reason: string,
    transaction: Prisma.TransactionClient
  ): Promise<PlatformRegistrationRecord>;
  get(componentId: string): Promise<PlatformRegistrationRecord | undefined>;
  list(): Promise<readonly PlatformRegistrationRecord[]>;
  updateState(
    componentId: string,
    status: PlatformRegistrationStatus,
    lifecycleState: PlatformLifecycleState,
    executionEnabled: boolean,
    reason: string,
    transaction: Prisma.TransactionClient
  ): Promise<PlatformRegistrationRecord>;
}

export type RegistryOperationPayload =
  | { manifest: ComponentManifest; reason: string }
  | {
      componentId: string;
      status: PlatformRegistrationStatus;
      lifecycleState: PlatformLifecycleState;
      executionEnabled: boolean;
      reason: string;
    }
  | { componentId: string; reason: string }
  | { componentId?: string };

export class PlatformRegistryService implements KernelComponentPort {
  readonly componentId = 'platform.registry';
  readonly capabilities = ['registry.read', 'registry.write'] as const;

  constructor(
    private readonly repository: PlatformRegistryRepository,
    private readonly transactions: DatabaseTransactionRunner
  ) {}

  async handle<TResult = unknown>(
    request: KernelOperationRequest<RegistryOperationPayload>
  ): Promise<TResult> {
    if (request.target !== this.componentId) throw new Error('Registry target is invalid');
    const result = await this.dispatch(request);
    return result as TResult;
  }

  private async dispatch(request: KernelOperationRequest<RegistryOperationPayload>) {
    if (request.action === 'list') return this.repository.list();
    if (request.action === 'read') {
      const componentId = readComponentId(request.payload);
      return this.repository.get(componentId);
    }
    if (request.action === 'register') {
      const payload = readRegistration(request.payload);
      validateManifest(payload.manifest);
      validateReason(payload.reason);
      return this.transactions.transaction((transaction) =>
        this.repository.register(payload.manifest, payload.reason, transaction)
      );
    }
    if (request.action === 'update') {
      const payload = readStateUpdate(request.payload);
      validateReason(payload.reason);
      return this.transactions.transaction((transaction) =>
        this.repository.updateState(
          payload.componentId,
          payload.status,
          payload.lifecycleState,
          payload.executionEnabled,
          payload.reason,
          transaction
        )
      );
    }
    if (request.action === 'unregister') {
      const componentId = readComponentId(request.payload);
      const reason = readReason(request.payload);
      return this.transactions.transaction((transaction) =>
        this.repository.updateState(componentId, 'removed', 'removed', false, reason, transaction)
      );
    }
    throw new Error('Registry action is unsupported');
  }
}

function validateManifest(manifest: ComponentManifest): void {
  const validation = validateComponentManifest(manifest);
  if (!validation.valid) throw new Error('Component manifest is invalid');
  if (manifest.kind === 'ai' && manifest.status === 'active') {
    throw new Error('AI manifests cannot be active during Gate 1');
  }
}

function validateReason(reason: string): void {
  if (!reason.trim()) throw new Error('Registry mutation reason is required');
}

function readRegistration(payload: RegistryOperationPayload | undefined): {
  manifest: ComponentManifest;
  reason: string;
} {
  if (!payload || !('manifest' in payload) || !('reason' in payload)) {
    throw new Error('Registry registration payload is invalid');
  }
  return payload;
}

function readStateUpdate(payload: RegistryOperationPayload | undefined) {
  if (
    !payload ||
    !('componentId' in payload) ||
    !payload.componentId ||
    !('status' in payload) ||
    !('lifecycleState' in payload) ||
    !('executionEnabled' in payload) ||
    !('reason' in payload)
  ) {
    throw new Error('Registry state payload is invalid');
  }
  return payload;
}

function readComponentId(payload: RegistryOperationPayload | undefined): string {
  if (!payload || !('componentId' in payload) || !payload.componentId?.trim()) {
    throw new Error('Registry component ID is required');
  }
  return payload.componentId;
}

function readReason(payload: RegistryOperationPayload | undefined): string {
  if (!payload || !('reason' in payload)) throw new Error('Registry reason is required');
  validateReason(payload.reason);
  return payload.reason;
}
