import type { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import type { DatabaseTransactionRunner } from '@/database/contracts';
import { createKernelRequestContext } from '@/platform/kernel/context';
import {
  FeatureFlagRegistryService,
  PersistentFeatureFlagProvider,
  type FeatureFlagOperationPayload,
  type FeatureFlagPersistence,
  type RegisteredFeatureFlag,
} from '@/platform/feature-flags/persistent-feature-flags';
import type { KernelOperationRequest } from '@/platform/kernel/contracts';

class FakeFlags implements FeatureFlagPersistence {
  readonly definitions = new Map<string, RegisteredFeatureFlag>();
  readonly values = new Map<string, boolean>();

  async register(
    name: string,
    ownerComponentId: string,
    description: string
  ): Promise<RegisteredFeatureFlag> {
    const definition: RegisteredFeatureFlag = {
      id: 'flag-1',
      name,
      ownerComponentId,
      description,
      status: 'available',
      secureDefault: false,
    };
    this.definitions.set(name, definition);
    return definition;
  }

  async setValue(name: string, environment: string, enabled: boolean, reason: string) {
    if (!this.definitions.has(name)) throw new Error('not registered');
    this.values.set(`${name}:${environment}`, enabled);
    return { name, enabled, source: 'test', reason };
  }

  async evaluate(name: string, environment: string) {
    const enabled = this.values.get(`${name}:${environment}`) ?? false;
    return { name, enabled, source: 'test', reason: enabled ? 'enabled' : 'secure default' };
  }

  async list(environment: string) {
    return Promise.all(
      [...this.definitions.keys()].map((name) => this.evaluate(name, environment))
    );
  }
}

const transactions: DatabaseTransactionRunner = {
  transaction: async <T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) =>
    operation({} as Prisma.TransactionClient),
};

function request(
  action: string,
  payload?: FeatureFlagOperationPayload
): KernelOperationRequest<FeatureFlagOperationPayload> {
  return {
    context: createKernelRequestContext({
      requestId: 'request-1',
      correlationId: 'correlation-1',
      environment: 'test',
      actor: { id: 'owner-1', kind: 'owner', authenticated: true },
      requestedAt: '2026-06-22T19:00:00.000Z',
    }),
    target: 'platform.feature-flags',
    capability: 'feature-flags.write',
    action,
    payload,
  };
}

describe('persistent Feature Flag service', () => {
  it('registers through a Registry owner and updates an environment value', async () => {
    const persistence = new FakeFlags();
    const service = new FeatureFlagRegistryService(persistence, transactions);
    await service.handle(
      request('register', {
        name: 'test.flag',
        ownerComponentId: 'test.service',
        description: 'Synthetic registered flag.',
        reason: 'Gate 1 registration',
      })
    );
    const decision = await service.handle<{ enabled: boolean }>(
      request('update', {
        name: 'test.flag',
        environment: 'test',
        enabled: true,
        reason: 'reversible synthetic action',
      })
    );

    expect(decision.enabled).toBe(true);
    const provider = new PersistentFeatureFlagProvider(persistence);
    await expect(provider.evaluate('test.flag', { environment: 'test' })).resolves.toMatchObject({
      enabled: true,
    });
    await expect(provider.list({ environment: 'test' })).resolves.toHaveLength(1);
  });

  it('rejects malformed, unsafe, and unsupported mutations', async () => {
    const service = new FeatureFlagRegistryService(new FakeFlags(), transactions);
    await expect(
      service.handle({ ...request('register'), target: 'platform.other' })
    ).rejects.toThrow('target');
    await expect(service.handle(request('register'))).rejects.toThrow('registration payload');
    await expect(
      service.handle(
        request('register', {
          name: 'INVALID FLAG',
          ownerComponentId: '',
          description: '',
          reason: '',
        })
      )
    ).rejects.toThrow('reason');
    await expect(service.handle(request('update'))).rejects.toThrow('update payload');
    await expect(
      service.handle(
        request('update', {
          name: 'test.flag',
          environment: 'invalid',
          enabled: true,
          reason: 'test',
        })
      )
    ).rejects.toThrow('environment');
    await expect(service.handle(request('delete'))).rejects.toThrow('unsupported');
  });
});
