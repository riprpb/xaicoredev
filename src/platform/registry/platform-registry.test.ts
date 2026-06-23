import type { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseTransactionRunner } from '@/database/contracts';
import type { KernelOperationRequest } from '@/platform/kernel/contracts';
import { createKernelRequestContext } from '@/platform/kernel/context';
import type { ComponentManifest } from '@/platform/manifests/contracts';
import {
  PlatformRegistryService,
  type RegistryOperationPayload,
  type PlatformRegistrationRecord,
  type PlatformRegistryRepository,
} from '@/platform/registry/platform-registry';

const now = '2026-06-22T18:00:00.000Z';
const manifest: ComponentManifest = {
  schemaVersion: '1.0',
  id: 'test.service',
  displayName: 'Test Service',
  version: '1.0.0',
  kind: 'service',
  description: 'Synthetic registry service.',
  owner: 'system-kernel',
  status: 'experimental',
  capabilities: ['test.read'],
  permissions: [],
  dependencies: [],
  endpoints: { health: '/health', readiness: '/ready', liveness: '/live' },
  configurationKeys: [],
  documentation: '/docs/test.md',
};

class FakeRegistry implements PlatformRegistryRepository {
  readonly records = new Map<string, PlatformRegistrationRecord>();

  async register(
    component: ComponentManifest,
    reason: string
  ): Promise<PlatformRegistrationRecord> {
    const record = createRecord(component, reason);
    this.records.set(component.id, record);
    return record;
  }

  async get(componentId: string): Promise<PlatformRegistrationRecord | undefined> {
    return this.records.get(componentId);
  }

  async list(): Promise<readonly PlatformRegistrationRecord[]> {
    return [...this.records.values()];
  }

  async updateState(
    componentId: string,
    status: PlatformRegistrationRecord['status'],
    lifecycleState: PlatformRegistrationRecord['lifecycleState'],
    executionEnabled: boolean,
    reason: string
  ): Promise<PlatformRegistrationRecord> {
    const current = this.records.get(componentId);
    if (!current) throw new Error('not registered');
    const updated = { ...current, status, lifecycleState, executionEnabled, reason };
    this.records.set(componentId, updated);
    return updated;
  }
}

const transactions: DatabaseTransactionRunner = {
  transaction: async <T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) =>
    operation({} as Prisma.TransactionClient),
};

function request(
  action: string,
  payload?: RegistryOperationPayload
): KernelOperationRequest<RegistryOperationPayload> {
  return {
    context: createKernelRequestContext({
      requestId: 'request-1',
      correlationId: 'correlation-1',
      environment: 'test',
      actor: { id: 'service-1', kind: 'service', authenticated: true },
      requestedAt: now,
    }),
    target: 'platform.registry',
    capability: action === 'read' || action === 'list' ? 'registry.read' : 'registry.write',
    action,
    payload,
  };
}

describe('PlatformRegistryService', () => {
  it('registers and reads validated manifests through a transaction', async () => {
    const repository = new FakeRegistry();
    const transactionSpy = vi.spyOn(transactions, 'transaction');
    const service = new PlatformRegistryService(repository, transactions);

    const registered = await service.handle<PlatformRegistrationRecord>(
      request('register', { manifest, reason: 'Gate 1 registration' })
    );
    const loaded = await service.handle<PlatformRegistrationRecord>(
      request('read', { componentId: manifest.id })
    );

    expect(registered).toMatchObject({
      componentId: manifest.id,
      lifecycleState: 'offline',
      executionEnabled: false,
    });
    expect(loaded.componentId).toBe(manifest.id);
    expect(transactionSpy).toHaveBeenCalledOnce();
  });

  it('updates and removes registrations only with a reason', async () => {
    const repository = new FakeRegistry();
    const service = new PlatformRegistryService(repository, transactions);
    await service.handle(request('register', { manifest, reason: 'initial' }));

    const disabled = await service.handle<PlatformRegistrationRecord>(
      request('update', {
        componentId: manifest.id,
        status: 'disabled',
        lifecycleState: 'shutdown',
        executionEnabled: false,
        reason: 'maintenance',
      })
    );
    expect(disabled.status).toBe('disabled');

    await expect(
      service.handle(
        request('update', {
          componentId: manifest.id,
          status: 'disabled',
          lifecycleState: 'shutdown',
          executionEnabled: false,
          reason: '',
        })
      )
    ).rejects.toThrow('reason');
    const removed = await service.handle<PlatformRegistrationRecord>(
      request('unregister', { componentId: manifest.id, reason: 'Owner-approved removal' })
    );
    expect(removed).toMatchObject({ status: 'removed', lifecycleState: 'removed' });
  });

  it('rejects active AI manifests and unsupported actions', async () => {
    const service = new PlatformRegistryService(new FakeRegistry(), transactions);
    await expect(
      service.handle(
        request('register', {
          manifest: { ...manifest, id: 'test.ai', kind: 'ai', status: 'active' },
          reason: 'invalid activation',
        })
      )
    ).rejects.toThrow('cannot be active');
    await expect(service.handle(request('execute'))).rejects.toThrow('unsupported');
  });

  it('fails closed for invalid targets and operation payloads', async () => {
    const service = new PlatformRegistryService(new FakeRegistry(), transactions);
    await expect(service.handle({ ...request('list'), target: 'platform.other' })).rejects.toThrow(
      'target'
    );
    await expect(service.handle(request('read'))).rejects.toThrow('component ID');
    await expect(service.handle(request('register', { componentId: manifest.id }))).rejects.toThrow(
      'registration payload'
    );
    await expect(
      service.handle(
        request('register', {
          manifest: { ...manifest, id: 'INVALID ID' },
          reason: 'invalid manifest',
        })
      )
    ).rejects.toThrow('manifest is invalid');
    await expect(service.handle(request('update'))).rejects.toThrow('state payload');
    await expect(
      service.handle(request('unregister', { componentId: manifest.id }))
    ).rejects.toThrow('reason');
    await expect(
      service.handle<readonly PlatformRegistrationRecord[]>(request('list'))
    ).resolves.toEqual([]);
  });
});

function createRecord(component: ComponentManifest, reason: string): PlatformRegistrationRecord {
  return {
    id: 'registration-1',
    componentId: component.id,
    manifest: component,
    status: 'registered',
    lifecycleState: 'offline',
    executionEnabled: false,
    reason,
    registeredAt: now,
    updatedAt: now,
  };
}
