import { describe, expect, it } from 'vitest'
import {
  InMemoryAIRegistry,
  type AIManifest,
} from '@/platform/registry/ai-registry'

const manifest: AIManifest = {
  schemaVersion: '1.0',
  id: 'test-ai',
  displayName: 'Test AI',
  version: '1.0.0',
  kind: 'ai',
  description: 'Validates the registry lifecycle.',
  owner: 'system-kernel',
  status: 'experimental',
  capabilities: ['test'],
  permissions: ['memory.read'],
  dependencies: [],
  endpoints: {
    health: '/health',
    readiness: '/ready',
    liveness: '/live',
  },
  configurationKeys: [],
  documentation: '/docs/ai/test-ai.md',
  classification: 'platform-intelligence',
  purpose: 'Exercise registry contracts only.',
  limitations: ['Does not perform AI work.'],
  brains: [],
  providerCapabilities: [],
}

describe('AI Registry lifecycle', () => {
  it('registers a valid manifest in the offline state', async () => {
    const registry = new InMemoryAIRegistry()
    const record = await registry.register(manifest)
    expect(record.status).toBe('registered')
    expect(record.lifecycleState).toBe('offline')
  })

  it('rejects duplicate registrations', async () => {
    const registry = new InMemoryAIRegistry()
    await registry.register(manifest)
    await expect(registry.register(manifest)).rejects.toThrow('already registered')
  })

  it('supports explicit disable and removal states', async () => {
    const registry = new InMemoryAIRegistry()
    await registry.register(manifest)
    await registry.disable(manifest.id, 'maintenance', 'owner')
    expect((await registry.get(manifest.id))?.status).toBe('disabled')
    await registry.remove(manifest.id, 'retired', 'owner')
    expect((await registry.get(manifest.id))?.status).toBe('removed')
  })
})
