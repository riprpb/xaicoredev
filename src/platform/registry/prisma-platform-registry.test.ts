import type { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { ComponentManifest } from '@/platform/manifests/contracts';
import { PrismaPlatformRegistryRepository } from '@/platform/registry/prisma-platform-registry';

const timestamp = new Date('2026-06-22T18:00:00.000Z');
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

function storedRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'registration-id',
    componentId: manifest.id,
    componentKind: 'SERVICE',
    activeManifestId: 'manifest-id',
    status: 'REGISTERED',
    lifecycleState: 'OFFLINE',
    executionEnabled: false,
    reason: 'synthetic registration',
    registeredAt: timestamp,
    updatedAt: timestamp,
    removedAt: null,
    activeManifest: { manifest },
    ...overrides,
  };
}

describe('PrismaPlatformRegistryRepository', () => {
  it('persists an immutable manifest and disabled registration', async () => {
    const transaction = {
      platformManifestRecord: {
        create: vi.fn().mockResolvedValue({ id: 'manifest-id' }),
      },
      platformRegistryRecord: {
        create: vi.fn().mockResolvedValue(storedRecord()),
      },
    } as unknown as Prisma.TransactionClient;
    const repository = new PrismaPlatformRegistryRepository({} as PrismaClient);

    const result = await repository.register(manifest, 'synthetic registration', transaction);

    expect(result).toMatchObject({ componentId: manifest.id, executionEnabled: false });
    expect(transaction.platformManifestRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        componentId: manifest.id,
        componentKind: 'SERVICE',
        manifestDigest: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    });
    expect(transaction.platformRegistryRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lifecycleState: 'OFFLINE', executionEnabled: false }),
      })
    );
  });

  it('refuses to enable or run an AI registration', async () => {
    const transaction = {
      platformRegistryRecord: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ componentKind: 'AI' }),
        update: vi.fn(),
      },
    } as unknown as Prisma.TransactionClient;
    const repository = new PrismaPlatformRegistryRepository({} as PrismaClient);

    await expect(
      repository.updateState(
        'test.ai',
        'registered',
        'running',
        true,
        'invalid activation',
        transaction
      )
    ).rejects.toThrow('disabled and offline');
    expect(transaction.platformRegistryRecord.update).not.toHaveBeenCalled();
  });

  it('maps reads, lists, and state updates to domain records', async () => {
    const database = {
      platformRegistryRecord: {
        findUnique: vi.fn().mockResolvedValueOnce(storedRecord()).mockResolvedValueOnce(null),
        findMany: vi.fn().mockResolvedValue([storedRecord()]),
      },
    } as unknown as PrismaClient;
    const transaction = {
      platformRegistryRecord: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ componentKind: 'SERVICE' }),
        update: vi.fn().mockResolvedValue(
          storedRecord({
            status: 'REMOVED',
            lifecycleState: 'REMOVED',
            removedAt: timestamp,
          })
        ),
      },
    } as unknown as Prisma.TransactionClient;
    const repository = new PrismaPlatformRegistryRepository(database);

    await expect(repository.get(manifest.id)).resolves.toMatchObject({
      componentId: manifest.id,
    });
    await expect(repository.get('missing.service')).resolves.toBeUndefined();
    await expect(repository.list()).resolves.toHaveLength(1);
    await expect(
      repository.updateState(manifest.id, 'removed', 'removed', false, 'retired', transaction)
    ).resolves.toMatchObject({ status: 'removed', removedAt: timestamp.toISOString() });
  });

  it('permits AI records only in disabled offline states', async () => {
    const transaction = {
      platformRegistryRecord: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ componentKind: 'AI' }),
        update: vi.fn().mockResolvedValue(
          storedRecord({
            componentId: 'test.ai',
            componentKind: 'AI',
            status: 'DISABLED',
            lifecycleState: 'OFFLINE',
          })
        ),
      },
    } as unknown as Prisma.TransactionClient;
    const repository = new PrismaPlatformRegistryRepository({} as PrismaClient);

    await expect(
      repository.updateState(
        'test.ai',
        'disabled',
        'offline',
        false,
        'Gate 1 offline policy',
        transaction
      )
    ).resolves.toMatchObject({ lifecycleState: 'offline', executionEnabled: false });
    await expect(
      repository.updateState(
        'test.ai',
        'disabled',
        'running',
        false,
        'invalid lifecycle',
        transaction
      )
    ).rejects.toThrow('offline');
  });
});
