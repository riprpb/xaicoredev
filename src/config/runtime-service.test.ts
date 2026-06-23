import { describe, expect, it } from 'vitest';
import { RuntimeConfigurationService } from '@/config/runtime-service';
import { createKernelRequestContext } from '@/platform/kernel/context';

const context = createKernelRequestContext({
  requestId: 'request-configuration-1',
  correlationId: 'correlation-configuration-1',
  environment: 'test',
  actor: { id: 'system.kernel', kind: 'service', authenticated: true },
  requestedAt: '2026-06-22T12:00:00.000Z',
});

describe('RuntimeConfigurationService', () => {
  it('returns registered public configuration through Kernel context', async () => {
    const service = new RuntimeConfigurationService({
      NODE_ENV: 'test',
      API_PORT: '3200',
    });

    const value = await service.get<number>('API_PORT', context);

    expect(value.descriptor.visibility).toBe('public');
    expect('value' in value && value.value).toBe(3200);
    expect(await service.listDescriptors()).toContainEqual(
      expect.objectContaining({ key: 'API_PORT', visibility: 'public' })
    );
  });

  it('maps every registered public runtime value', async () => {
    const service = new RuntimeConfigurationService({
      NODE_ENV: 'test',
      API_HOST: '127.0.0.2',
      API_PORT: '3200',
      CORS_ALLOWED_ORIGINS: 'http://localhost:5174',
      API_RATE_LIMIT: '25',
      API_RATE_WINDOW_MS: '60000',
    });

    const expected: Readonly<Record<string, unknown>> = {
      NODE_ENV: 'test',
      API_HOST: '127.0.0.2',
      API_PORT: 3200,
      CORS_ALLOWED_ORIGINS: ['http://localhost:5174'],
      API_RATE_LIMIT: 25,
      API_RATE_WINDOW_MS: 60000,
    };
    for (const [key, expectedValue] of Object.entries(expected)) {
      const result = await service.get(key, context);
      expect('value' in result && result.value).toEqual(expectedValue);
    }
  });

  it('returns opaque references without resolving secrets', async () => {
    const service = new RuntimeConfigurationService({
      NODE_ENV: 'test',
      DATABASE_URL_SECRET_REF: 'test/database-url',
    });

    const value = await service.get('DATABASE_URL_SECRET_REF', context);

    expect(value).toEqual(
      expect.objectContaining({
        secretReference: 'test/database-url',
        source: 'environment-reference',
      })
    );
    expect(value).not.toHaveProperty('value');
  });

  it('denies raw secret and cross-profile reads', async () => {
    const service = new RuntimeConfigurationService({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://user:secret@localhost/database',
    });
    await expect(service.get('DATABASE_URL', context)).rejects.toThrow(
      'Secret configuration is not available'
    );

    const wrongContext = { ...context, environment: 'production' };
    await expect(service.get('API_PORT', wrongContext)).rejects.toThrow(
      'Kernel context does not match'
    );
    await expect(service.get('UNKNOWN_CONFIGURATION', context)).rejects.toThrow(
      'Configuration key is not registered'
    );
    await expect(service.get('DATABASE_URL_SECRET_REF', context)).rejects.toThrow(
      'Sensitive configuration reference is unavailable'
    );
  });

  it('returns validation results without throwing', async () => {
    const service = new RuntimeConfigurationService({});

    await expect(service.validate('development')).resolves.toEqual({
      valid: true,
      errors: [],
    });
    await expect(service.validate('production')).resolves.toEqual({
      valid: false,
      errors: ['API_HOST is required in staging and production'],
    });
  });
});
