import compression from 'compression'
import cors from 'cors'
import express, { type Express } from 'express'
import type { PrismaClient } from '@prisma/client'
import helmet from 'helmet'
import { pinoHttp } from 'pino-http'
import {
  adminRouter,
  authRouter,
  errorHandler,
  hallRouter,
  meRouter,
  metaRouter,
  requestContext,
  solutionRouter,
  sprintRouter,
  submissionRouter,
} from './api/index.js'
import { buildContainer, env, logger, type Container } from './core/index.js'

export interface AppOptions {
  prisma: PrismaClient
  container?: Container
}

export function createApp({ prisma, container }: AppOptions): Express {
  const services = container ?? buildContainer(prisma)
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(compression())
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
    })
  )
  app.use(requestContext())
  app.use(express.json({ limit: '128kb' }))
  app.use(
    pinoHttp({
      logger,
      customProps: (req): Record<string, unknown> => ({
        requestId: (req as express.Request).requestId,
      }),
      customLogLevel: (_req, res, err) => {
        if (err || res.statusCode >= 500) return 'error'
        if (res.statusCode >= 400) return 'warn'
        return 'info'
      },
      autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
    })
  )

  app.get('/api/v1/health', (_req, res) => {
    res.json({ ok: true, service: 'basalt-bff', version: '2.0.0' })
  })

  app.use('/api/v1/auth', authRouter(services))
  app.use('/api/v1/me', meRouter(services))
  app.use('/api/v1/meta', metaRouter(services))
  app.use('/api/v1/sprints', sprintRouter(services))
  app.use('/api/v1/submissions', submissionRouter(services))
  app.use('/api/v1/solutions', solutionRouter(services))
  app.use('/api/v1/hall', hallRouter(services))
  app.use('/api/v1/admin', adminRouter(services.admin))

  app.use((_req, res) => {
    res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' })
  })

  app.use(errorHandler())

  return app
}
