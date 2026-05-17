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
import { mockRouter } from './routes/mock.routes.js'
import { metricsMiddleware, metricsRegistry } from './infra/metrics.js'
import { runHealthCheck } from './infra/health.js'
import { getRedis } from './infra/redis.js'
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
      autoLogging: {
        ignore: (req) =>
          req.url === '/api/v1/health' ||
          req.url === '/api/v1/health/ready' ||
          req.url === '/metrics',
      },
    })
  )

  // Метрики собираем после requestContext/pino, но до бизнес-роутов.
  app.use(metricsMiddleware)

  // Liveness — простой, не трогает зависимости. Для самой быстрой проверки "процесс жив".
  app.get('/api/v1/health', (_req, res) => {
    res.json({ ok: true, service: 'basalt-bff', version: '2.0.0' })
  })

  // Readiness — пингует Postgres и Redis. 200 если всё ок, 503 иначе.
  // Используется k8s readinessProbe или nginx healthcheck для автоматического failover.
  app.get('/api/v1/health/ready', async (_req, res) => {
    const report = await runHealthCheck({
      prisma,
      redis: getRedis(),
      version: '2.0.0',
    })
    res.status(report.ok ? 200 : 503).json(report)
  })

  // Prometheus scrape endpoint.
  // Не закрываем авторизацией намеренно: scrape-job в k8s/Prometheus идёт по сети без токенов.
  // На проде эндпоинт закрывается на уровне reverse proxy / firewall.
  app.get('/metrics', async (_req, res) => {
    res.setHeader('Content-Type', metricsRegistry.contentType)
    res.end(await metricsRegistry.metrics())
  })

  app.use('/api/v1/auth', authRouter(services))
  app.use('/api/v1/me', meRouter(services))
  app.use('/api/v1/meta', metaRouter(services))
  app.use('/api/v1/sprints', sprintRouter(services))
  app.use('/api/v1/submissions', submissionRouter(services))
  app.use('/api/v1/solutions', solutionRouter(services))
  app.use('/api/v1/hall', hallRouter(services))
  app.use('/api/v1/admin', adminRouter(services.admin))
  // Контракт под внешний фронт из конкурса (basalt-arena). Слушает `/api/mock/v1` и `/api/mock/v1/v2`.
  app.use('/api/mock/v1', mockRouter(services))

  app.use((req, res) => {
    if ((req.originalUrl ?? req.url ?? '').startsWith('/api/mock/')) {
      res.status(404).json({ error: 'Route not found' })
      return
    }
    res.status(404).json({ code: 'NOT_FOUND', message: 'Route not found' })
  })

  app.use(errorHandler())

  return app
}
