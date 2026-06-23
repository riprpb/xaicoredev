import { describe, expect, it } from 'vitest';
import {
  getRuntimeConfig,
  getServerConfig,
  RUNTIME_CONFIGURATION_SCHEMA,
  RUNTIME_PROFILES,
} from '@/config/environment';

describe('runtime configuration', () => {
  it('uses secure local development defaults', () => {
    const config = getRuntimeConfig({ NODE_ENV: 'development' });
    expect(config.public.server.host).toBe('127.0.0.1');
    expect(config.public.server.allowedOrigins).toEqual(['http://localhost:5173']);
  });

  it.each(RUNTIME_PROFILES)('supports the %s profile', (profile) => {
    const deployed = profile === 'staging' || profile === 'production';
    const config = getRuntimeConfig({
      NODE_ENV: profile,
      API_HOST: deployed ? '0.0.0.0' : undefined,
      CORS_ALLOWED_ORIGINS: deployed ? 'https://xaicore.dev' : undefined,
    });
    expect(config.profile).toBe(profile);
  });

  it('requires explicit host and CORS origins in deployed profiles', () => {
    expect(() => getServerConfig({ NODE_ENV: 'production' })).toThrow(
      'API_HOST is required in staging and production'
    );
    expect(() => getServerConfig({ NODE_ENV: 'staging', API_HOST: '0.0.0.0' })).toThrow(
      'CORS_ALLOWED_ORIGINS is required in staging and production'
    );
  });

  it('rejects insecure or malformed deployed origins', () => {
    expect(() =>
      getServerConfig({
        NODE_ENV: 'production',
        API_HOST: '0.0.0.0',
        CORS_ALLOWED_ORIGINS: 'http://xaicore.dev',
      })
    ).toThrow('production CORS origins must use HTTPS');
    expect(() =>
      getServerConfig({
        NODE_ENV: 'staging',
        API_HOST: '0.0.0.0',
        CORS_ALLOWED_ORIGINS: 'https://xaicore.dev/path',
      })
    ).toThrow('CORS origins must not include a path');
    expect(() =>
      getServerConfig({
        NODE_ENV: 'production',
        API_HOST: '0.0.0.0',
        CORS_ALLOWED_ORIGINS: 'not-an-origin',
      })
    ).toThrow('CORS origin is not a valid URL');
    expect(() =>
      getServerConfig({
        NODE_ENV: 'production',
        API_HOST: '0.0.0.0',
        CORS_ALLOWED_ORIGINS: 'https://user:password@xaicore.dev',
      })
    ).toThrow('CORS origins must not include credentials');
  });

  it('rejects invalid numeric configuration', () => {
    expect(() => getServerConfig({ NODE_ENV: 'test', API_RATE_LIMIT: 'unlimited' })).toThrow(
      'Expected a positive integer'
    );
    expect(() => getServerConfig({ NODE_ENV: 'test', API_PORT: '3000garbage' })).toThrow(
      'Expected a positive integer'
    );
    expect(() => getServerConfig({ NODE_ENV: 'test', API_PORT: '9'.repeat(400) })).toThrow(
      'Expected a positive integer'
    );
  });

  it('rejects unknown runtime profiles', () => {
    expect(() => getRuntimeConfig({ NODE_ENV: 'preview' })).toThrow('NODE_ENV must be one of');
  });

  it('returns references but never raw secret values', () => {
    const config = getRuntimeConfig({
      NODE_ENV: 'development',
      DATABASE_URL: 'postgresql://user:secret@localhost/database',
      DATABASE_URL_SECRET_REF: 'local/database-url',
    });

    expect(config.sensitiveReferences.databaseUrl).toBe('local/database-url');
    expect(JSON.stringify(config)).not.toContain('postgresql://user:secret');
    expect(
      RUNTIME_CONFIGURATION_SCHEMA.find((item) => item.key === 'DATABASE_URL')?.visibility
    ).toBe('secret');
  });

  it('rejects secret values supplied as references', () => {
    expect(() =>
      getRuntimeConfig({
        NODE_ENV: 'test',
        DATABASE_URL_SECRET_REF: 'postgresql://user:secret@localhost/database',
      })
    ).toThrow('Secret references must be opaque identifiers');
  });
});
