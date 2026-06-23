import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import type { ServerConfig } from '../config/environment.ts';
import type { HealthContract } from '@/platform/contracts/health';
import { PlatformHealthService } from '@/platform/observability/health';
import {
  ConsoleJsonLogSink,
  StructuredLogger,
  type StructuredLogSink,
} from '@/platform/observability/logging';
import { MetricsRegistry } from '@/platform/observability/metrics';
import { registerObservabilityRoutes } from '@/platform/observability/routes';
import {
  registerOwnerOperationsRoutes,
  type OwnerOperationsRoutes,
} from '@/owner-operations/routes';

const CORRELATION_HEADER = 'x-correlation-id';
const APPLICATION_VERSION = '1.0.0';

export interface AppObservability {
  health?: HealthContract;
  metrics?: MetricsRegistry;
  logSink?: StructuredLogSink;
  ownerOperations?: OwnerOperationsRoutes;
}

export function createApp(config: ServerConfig, observability: AppObservability = {}): Express {
  const app = express();
  const metrics = observability.metrics ?? new MetricsRegistry();
  const logger = new StructuredLogger(observability.logSink ?? new ConsoleJsonLogSink());
  const health =
    observability.health ??
    new PlatformHealthService('xaicore-api', APPLICATION_VERSION, [
      { id: 'runtime-config', required: true, check: async () => 'healthy' },
    ]);

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin is not allowed'));
      },
    })
  );
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestedId = req.header(CORRELATION_HEADER);
    const correlationId = requestedId?.slice(0, 128) || randomUUID();
    res.locals.correlationId = correlationId;
    res.setHeader(CORRELATION_HEADER, correlationId);
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(
    '/api',
    rateLimit({
      windowMs: config.apiRateWindowMs,
      limit: config.apiRateLimit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    })
  );

  registerObservabilityRoutes(app, {
    health,
    metrics,
    version: APPLICATION_VERSION,
    environment: config.environment,
  });
  if (observability.ownerOperations) {
    registerOwnerOperationsRoutes(app, observability.ownerOperations);
  }

  app.get('/api', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: { message: 'XAICore API Server', version: APPLICATION_VERSION },
    });
  });

  app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
    void next;
    const correlationId = String(res.locals.correlationId ?? randomUUID());
    logger.log('error', 'http.request.failed', undefined, {
      correlationId,
      errorType: error.name,
    });
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      correlationId,
    });
  });

  return app;
}
