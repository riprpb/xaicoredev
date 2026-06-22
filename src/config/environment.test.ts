import { describe, expect, it } from 'vitest'
import { getServerConfig } from '@/config/environment'

describe('server configuration', () => {
  it('uses secure local development defaults', () => {
    const config = getServerConfig({ NODE_ENV: 'development' })
    expect(config.host).toBe('127.0.0.1')
    expect(config.allowedOrigins).toEqual(['http://localhost:5173'])
  })

  it('requires explicit CORS origins in production', () => {
    expect(() => getServerConfig({ NODE_ENV: 'production' })).toThrow(
      'CORS_ALLOWED_ORIGINS is required in production',
    )
  })

  it('rejects invalid numeric configuration', () => {
    expect(() =>
      getServerConfig({ NODE_ENV: 'test', API_RATE_LIMIT: 'unlimited' }),
    ).toThrow('Expected a positive integer')
  })
})
