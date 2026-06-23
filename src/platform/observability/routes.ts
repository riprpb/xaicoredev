import type { Express, Response } from 'express';
import type { HealthContract } from '@/platform/contracts/health';
import { MetricsRegistry } from '@/platform/observability/metrics';

export interface ObservabilityRouteOptions {
  health: HealthContract;
  metrics: MetricsRegistry;
  version: string;
  environment: string;
}

export function registerObservabilityRoutes(
  app: Express,
  options: ObservabilityRouteOptions
): void {
  app.get('/api/health', async (_request, response, next) => {
    try {
      const health = await options.health.checkHealth();
      options.metrics.increment('http.health.requests');
      respondWithHealth(response, health);
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/health/live', async (_request, response, next) => {
    try {
      const health = await options.health.checkLiveness();
      options.metrics.increment('http.liveness.requests');
      respondWithHealth(response, health);
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/health/ready', async (_request, response, next) => {
    try {
      const health = await options.health.checkReadiness();
      options.metrics.increment('http.readiness.requests');
      respondWithHealth(response, health);
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/version', (_request, response) => {
    options.metrics.increment('http.version.requests');
    response.json({
      success: true,
      data: { version: options.version, environment: options.environment },
    });
  });
  app.get('/api/metrics', (_request, response) => {
    options.metrics.increment('http.metrics.requests');
    response.json({ success: true, data: options.metrics.snapshot() });
  });
}

function respondWithHealth(
  response: Response,
  health: Awaited<ReturnType<HealthContract['checkHealth']>>
): void {
  response.status(health.status === 'unhealthy' ? 503 : 200).json({
    success: health.status !== 'unhealthy',
    data: health,
  });
}
