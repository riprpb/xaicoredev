import type { ConfigurationDescriptor } from '@/platform/config/contracts';

export const RUNTIME_PROFILES = ['development', 'test', 'staging', 'production'] as const;

export type RuntimeProfile = (typeof RUNTIME_PROFILES)[number];

export interface ServerConfig {
  environment: RuntimeProfile;
  host: string;
  port: number;
  allowedOrigins: readonly string[];
  apiRateLimit: number;
  apiRateWindowMs: number;
}

export interface SensitiveConfigurationReferences {
  databaseUrl?: string;
}

export interface RuntimeConfig {
  profile: RuntimeProfile;
  public: {
    server: ServerConfig;
  };
  sensitiveReferences: SensitiveConfigurationReferences;
}

export const RUNTIME_CONFIGURATION_SCHEMA = [
  {
    key: 'NODE_ENV',
    visibility: 'public',
    required: true,
    environments: RUNTIME_PROFILES,
    description: 'XAICore runtime profile.',
  },
  {
    key: 'API_HOST',
    visibility: 'public',
    required: true,
    environments: ['staging', 'production'],
    description: 'API bind host.',
  },
  {
    key: 'API_PORT',
    visibility: 'public',
    required: false,
    environments: RUNTIME_PROFILES,
    description: 'API bind port.',
  },
  {
    key: 'CORS_ALLOWED_ORIGINS',
    visibility: 'public',
    required: true,
    environments: ['staging', 'production'],
    description: 'Comma-separated browser origins allowed to call the API.',
  },
  {
    key: 'API_RATE_LIMIT',
    visibility: 'public',
    required: false,
    environments: RUNTIME_PROFILES,
    description: 'Maximum API requests permitted in a rate-limit window.',
  },
  {
    key: 'API_RATE_WINDOW_MS',
    visibility: 'public',
    required: false,
    environments: RUNTIME_PROFILES,
    description: 'API rate-limit window in milliseconds.',
  },
  {
    key: 'DATABASE_URL',
    visibility: 'secret',
    required: false,
    environments: ['development', 'test'],
    description: 'Local Prisma connection secret; never returned by runtime config.',
  },
  {
    key: 'DATABASE_URL_SECRET_REF',
    visibility: 'sensitive-reference',
    required: false,
    environments: ['staging', 'production'],
    description: 'Opaque reference resolved by the future approved secret provider.',
  },
] as const satisfies readonly ConfigurationDescriptor[];

export function getRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const profile = parseProfile(environment.NODE_ENV);
  const host = environment.API_HOST ?? environment.HOST ?? '127.0.0.1';
  const allowedOrigins = parseOrigins(environment.CORS_ALLOWED_ORIGINS);

  if (isDeployedProfile(profile)) {
    if (!environment.API_HOST?.trim()) {
      throw new Error('API_HOST is required in staging and production');
    }
    if (allowedOrigins.length === 0) {
      throw new Error('CORS_ALLOWED_ORIGINS is required in staging and production');
    }
    validateSecureOrigins(allowedOrigins, profile);
  }

  return {
    profile,
    public: {
      server: {
        environment: profile,
        host,
        port: parsePositiveInteger(environment.API_PORT ?? environment.PORT, 3000),
        allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : ['http://localhost:5173'],
        apiRateLimit: parsePositiveInteger(environment.API_RATE_LIMIT, 100),
        apiRateWindowMs: parsePositiveInteger(environment.API_RATE_WINDOW_MS, 15 * 60 * 1000),
      },
    },
    sensitiveReferences: {
      databaseUrl: parseOptionalReference(environment.DATABASE_URL_SECRET_REF),
    },
  };
}

export function getServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  return getRuntimeConfig(environment).public.server;
}

function parseProfile(value: string | undefined): RuntimeProfile {
  const profile = value ?? 'development';
  if (!RUNTIME_PROFILES.includes(profile as RuntimeProfile)) {
    throw new Error(`NODE_ENV must be one of: ${RUNTIME_PROFILES.join(', ')}`);
  }
  return profile as RuntimeProfile;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value)) {
    throw new Error('Expected a positive integer configuration value');
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('Expected a positive integer configuration value');
  }
  return parsed;
}

function parseOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function validateSecureOrigins(origins: readonly string[], profile: RuntimeProfile): void {
  for (const origin of origins) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error(`CORS origin is not a valid URL: ${origin}`);
    }
    if (url.protocol !== 'https:') {
      throw new Error(`${profile} CORS origins must use HTTPS`);
    }
    if (url.username || url.password) {
      throw new Error('CORS origins must not include credentials');
    }
    if (url.pathname !== '/' || url.search || url.hash) {
      throw new Error('CORS origins must not include a path, query, or fragment');
    }
  }
}

function parseOptionalReference(value: string | undefined): string | undefined {
  const reference = value?.trim();
  if (!reference) return undefined;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{2,255}$/.test(reference)) {
    throw new Error('Secret references must be opaque identifiers, not secret values');
  }
  return reference;
}

function isDeployedProfile(profile: RuntimeProfile): boolean {
  return profile === 'staging' || profile === 'production';
}
