export interface ServerConfig {
  environment: 'development' | 'test' | 'production'
  host: string
  port: number
  allowedOrigins: readonly string[]
  apiRateLimit: number
  apiRateWindowMs: number
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('Expected a positive integer configuration value')
  }
  return parsed
}

export function getServerConfig(
  environment: NodeJS.ProcessEnv = process.env,
): ServerConfig {
  const runtime = environment.NODE_ENV ?? 'development'
  if (!['development', 'test', 'production'].includes(runtime)) {
    throw new Error('NODE_ENV must be development, test, or production')
  }

  const allowedOrigins = (environment.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (runtime === 'production' && allowedOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS is required in production')
  }

  return {
    environment: runtime as ServerConfig['environment'],
    host: environment.API_HOST ?? environment.HOST ?? '127.0.0.1',
    port: parsePositiveInteger(environment.API_PORT ?? environment.PORT, 3000),
    allowedOrigins:
      allowedOrigins.length > 0 ? allowedOrigins : ['http://localhost:5173'],
    apiRateLimit: parsePositiveInteger(environment.API_RATE_LIMIT, 100),
    apiRateWindowMs: parsePositiveInteger(
      environment.API_RATE_WINDOW_MS,
      15 * 60 * 1000,
    ),
  }
}
