import type { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaFeatureFlagPersistence } from '@/platform/feature-flags/prisma-feature-flags';

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    platformRegistryRecord: {
      findUnique: vi.fn().mockResolvedValue({ id: 'registry-1', status: 'REGISTERED' }),
    },
    featureFlagDefinition: {
      create: vi.fn().mockResolvedValue({
        id: 'flag-1',
        name: 'test.flag',
        description: 'Synthetic flag',
      }),
      findUnique: vi.fn().mockResolvedValue({ id: 'flag-1', status: 'AVAILABLE' }),
    },
    featureFlagValue: {
      upsert: vi.fn().mockResolvedValue({ enabled: true, reason: 'synthetic update' }),
    },
    ...overrides,
  } as unknown as Prisma.TransactionClient;
}

describe('PrismaFeatureFlagPersistence', () => {
  it('requires an active Registry owner before definition persistence', async () => {
    const missingOwner = transaction({
      platformRegistryRecord: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const disabledOwner = transaction({
      platformRegistryRecord: {
        findUnique: vi.fn().mockResolvedValue({ id: 'registry-1', status: 'DISABLED' }),
      },
    });
    const repository = new PrismaFeatureFlagPersistence({} as PrismaClient);

    await expect(
      repository.register('test.flag', 'missing.service', 'Synthetic flag', missingOwner)
    ).rejects.toThrow('active Registry');
    await expect(
      repository.register('test.flag', 'disabled.service', 'Synthetic flag', disabledOwner)
    ).rejects.toThrow('active Registry');
  });

  it('registers secure-false definitions and persists versioned values', async () => {
    const tx = transaction();
    const repository = new PrismaFeatureFlagPersistence({} as PrismaClient);

    await expect(
      repository.register('test.flag', 'test.service', 'Synthetic flag', tx)
    ).resolves.toMatchObject({ secureDefault: false, ownerComponentId: 'test.service' });
    await expect(
      repository.setValue('test.flag', 'test', true, 'synthetic update', tx)
    ).resolves.toEqual({
      name: 'test.flag',
      enabled: true,
      source: 'persistent-registry',
      reason: 'synthetic update',
    });
    expect(tx.featureFlagDefinition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ secureDefault: false }),
    });
    expect(tx.featureFlagValue.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: expect.objectContaining({ version: { increment: 1 } }) })
    );
  });

  it('rejects unknown and unavailable value mutations', async () => {
    const unknown = transaction({
      featureFlagDefinition: { findUnique: vi.fn().mockResolvedValue(null) },
    });
    const unavailable = transaction({
      featureFlagDefinition: {
        findUnique: vi.fn().mockResolvedValue({ id: 'flag-1', status: 'UNAVAILABLE' }),
      },
    });
    const repository = new PrismaFeatureFlagPersistence({} as PrismaClient);

    await expect(
      repository.setValue('unknown.flag', 'test', true, 'invalid', unknown)
    ).rejects.toThrow('not registered');
    await expect(
      repository.setValue('test.flag', 'test', true, 'invalid', unavailable)
    ).rejects.toThrow('unavailable');
  });

  it('evaluates unknown, unavailable, defaulted, and configured flags securely', async () => {
    const database = {
      featureFlagDefinition: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ name: 'unavailable.flag', status: 'UNAVAILABLE', values: [] })
          .mockResolvedValueOnce({ name: 'default.flag', status: 'AVAILABLE', values: [] })
          .mockResolvedValueOnce({
            name: 'enabled.flag',
            status: 'AVAILABLE',
            values: [{ enabled: true, reason: 'Owner-approved test' }],
          }),
        findMany: vi.fn().mockResolvedValue([
          { name: 'default.flag', status: 'AVAILABLE', values: [] },
          {
            name: 'enabled.flag',
            status: 'AVAILABLE',
            values: [{ enabled: true, reason: 'Owner-approved test' }],
          },
          { name: 'retired.flag', status: 'RETIRED', values: [] },
        ]),
      },
    } as unknown as PrismaClient;
    const repository = new PrismaFeatureFlagPersistence(database);

    await expect(repository.evaluate('unknown.flag', 'test')).resolves.toMatchObject({
      enabled: false,
      reason: 'unregistered Feature Flag',
    });
    await expect(repository.evaluate('unavailable.flag', 'test')).resolves.toMatchObject({
      enabled: false,
      reason: 'unavailable Feature Flag',
    });
    await expect(repository.evaluate('default.flag', 'test')).resolves.toMatchObject({
      enabled: false,
      reason: 'secure default',
    });
    await expect(repository.evaluate('enabled.flag', 'test')).resolves.toMatchObject({
      enabled: true,
    });
    await expect(repository.list('test')).resolves.toEqual([
      expect.objectContaining({ name: 'default.flag', enabled: false }),
      expect.objectContaining({ name: 'enabled.flag', enabled: true }),
      expect.objectContaining({ name: 'retired.flag', enabled: false }),
    ]);
  });
});
