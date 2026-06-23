import {
  getRuntimeConfig,
  RUNTIME_CONFIGURATION_SCHEMA,
  type RuntimeConfig,
} from '@/config/environment';
import type {
  ConfigurationDescriptor,
  ConfigurationValidationResult,
  ConfigurationValue,
  KernelConfigurationReader,
  KernelConfigurationValidator,
  PublicConfigurationValue,
  ReferencedConfigurationValue,
} from '@/platform/config/contracts';
import type { KernelRequestContext } from '@/platform/kernel/context';

export class RuntimeConfigurationService
  implements KernelConfigurationReader, KernelConfigurationValidator
{
  private readonly environment: Readonly<NodeJS.ProcessEnv>;

  constructor(environment: NodeJS.ProcessEnv = process.env) {
    this.environment = { ...environment };
  }

  async get<T>(key: string, context: KernelRequestContext): Promise<ConfigurationValue<T>> {
    const descriptor = requireDescriptor(key);
    if (descriptor.visibility === 'secret') {
      throw new Error('Secret configuration is not available through the Kernel reader');
    }

    const config = getRuntimeConfig(this.environment);
    if (context.environment !== config.profile) {
      throw new Error('Kernel context does not match the configuration profile');
    }

    if (descriptor.visibility === 'sensitive-reference') {
      const secretReference = getSensitiveReference(key, config);
      if (!secretReference) {
        throw new Error('Sensitive configuration reference is unavailable');
      }
      return {
        descriptor: descriptor as ReferencedConfigurationValue['descriptor'],
        secretReference,
        source: 'environment-reference',
      };
    }

    return {
      descriptor: descriptor as PublicConfigurationValue<T>['descriptor'],
      value: getPublicValue(key, config) as T,
      source: 'validated-runtime',
    };
  }

  async listDescriptors(): Promise<readonly ConfigurationDescriptor[]> {
    return RUNTIME_CONFIGURATION_SCHEMA;
  }

  async validate(environment: string): Promise<ConfigurationValidationResult> {
    try {
      getRuntimeConfig({ ...this.environment, NODE_ENV: environment });
      return { valid: true, errors: [] };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : 'Runtime configuration is invalid'],
      };
    }
  }
}

function requireDescriptor(key: string): ConfigurationDescriptor {
  const descriptor = RUNTIME_CONFIGURATION_SCHEMA.find((item) => item.key === key);
  if (!descriptor) throw new Error('Configuration key is not registered');
  return descriptor;
}

function getPublicValue(key: string, config: RuntimeConfig): unknown {
  switch (key) {
    case 'NODE_ENV':
      return config.profile;
    case 'API_HOST':
      return config.public.server.host;
    case 'API_PORT':
      return config.public.server.port;
    case 'CORS_ALLOWED_ORIGINS':
      return config.public.server.allowedOrigins;
    case 'API_RATE_LIMIT':
      return config.public.server.apiRateLimit;
    case 'API_RATE_WINDOW_MS':
      return config.public.server.apiRateWindowMs;
    default:
      throw new Error('Public configuration key has no runtime mapping');
  }
}

function getSensitiveReference(key: string, config: RuntimeConfig): string | undefined {
  if (key === 'DATABASE_URL_SECRET_REF') {
    return config.sensitiveReferences.databaseUrl;
  }
  return undefined;
}
