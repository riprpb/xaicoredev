import { describe, expect, it } from 'vitest'
import { ConfigurationFeatureFlagProvider } from '@/platform/feature-flags/contracts'

const context = { environment: 'test' }

describe('configuration feature flags', () => {
  it('returns configured values', async () => {
    const provider = new ConfigurationFeatureFlagProvider({ kernel: true })
    expect((await provider.evaluate('kernel', context)).enabled).toBe(true)
  })

  it('fails closed for unknown flags', async () => {
    const provider = new ConfigurationFeatureFlagProvider({})
    const decision = await provider.evaluate('experimental', context)
    expect(decision.enabled).toBe(false)
    expect(decision.reason).toBe('secure default')
  })
})
