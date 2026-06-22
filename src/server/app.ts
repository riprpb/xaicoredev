import { randomUUID } from 'node:crypto'
import cors from 'cors'
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import type { ServerConfig } from '../config/environment.ts'

const CORRELATION_HEADER = 'x-correlation-id'

export function createApp(config: ServerConfig): Express {
  const app = express()

  app.disable('x-powered-by')
  app.use(helmet())
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || config.allowedOrigins.includes(origin)) {
          callback(null, true)
          return
        }
        callback(new Error('Origin is not allowed'))
      },
    }),
  )
  app.use((req: Request, res: Response, next: NextFunction) => {
    const requestedId = req.header(CORRELATION_HEADER)
    const correlationId = requestedId?.slice(0, 128) || randomUUID()
    res.locals.correlationId = correlationId
    res.setHeader(CORRELATION_HEADER, correlationId)
    next()
  })
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true, limit: '1mb' }))
  app.use(
    '/api',
    rateLimit({
      windowMs: config.apiRateWindowMs,
      limit: config.apiRateLimit,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
    }),
  )

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: {
        status: 'healthy',
        service: 'xaicore-api',
        version: '1.0.0',
        environment: config.environment,
        timestamp: new Date().toISOString(),
      },
    })
  })

  app.get('/api', (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: { message: 'XAICore API Server', version: '1.0.0' },
    })
  })

  app.use(
    (error: Error, _req: Request, res: Response, next: NextFunction) => {
      void next
      const correlationId = String(res.locals.correlationId ?? randomUUID())
      console.error(
        JSON.stringify({
          level: 'error',
          event: 'http.request.failed',
          correlationId,
          errorType: error.name,
          timestamp: new Date().toISOString(),
        }),
      )
      res.status(500).json({
        success: false,
        error: 'Internal server error',
        correlationId,
      })
    },
  )

  return app
}
