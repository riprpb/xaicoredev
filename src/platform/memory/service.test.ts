import { describe, expect, it } from 'vitest';
import type { BrainContract, MemoryRegistry } from '@/platform/memory/contracts';
import { MemoryFoundationService } from '@/platform/memory/service';

const brain: BrainContract = {
  id: 'platform-memory',
  name: 'Platform Memory',
  description: 'Synthetic foundation metadata only.',
  schemaVersion: '1.0',
  retentionPolicyId: 'test-retention',
  encryptionPolicyId: 'test-encryption',
  supportedOperations: ['read'],
};

const registry: MemoryRegistry = {
  registerBrain: async () => undefined,
  getBrain: async (id) => (id === brain.id ? brain : undefined),
  listBrains: async () => [brain],
  getPermissions: async () => [],
};

describe('MemoryFoundationService', () => {
  it('exposes only Kernel-managed foundation reads', async () => {
    const service = new MemoryFoundationService(registry);
    await expect(
      service.handle({
        context: {} as never,
        target: 'platform.memory',
        capability: 'memory.read',
        action: 'list',
      })
    ).resolves.toEqual([brain]);
    await expect(
      service.handle({
        context: {} as never,
        target: 'platform.memory',
        capability: 'memory.read',
        action: 'read',
        payload: { id: brain.id },
      })
    ).resolves.toEqual(brain);
  });

  it('rejects bypasses, mutations, and missing Brain identifiers', async () => {
    const service = new MemoryFoundationService(registry);
    await expect(
      service.handle({
        context: {} as never,
        target: 'platform.other',
        capability: 'memory.read',
        action: 'list',
      })
    ).rejects.toThrow('invalid');
    await expect(
      service.handle({
        context: {} as never,
        target: 'platform.memory',
        capability: 'memory.read',
        action: 'read',
      })
    ).rejects.toThrow('ID');
    await expect(
      service.handle({
        context: {} as never,
        target: 'platform.memory',
        capability: 'memory.read',
        action: 'write',
      })
    ).rejects.toThrow('unsupported');
  });
});
