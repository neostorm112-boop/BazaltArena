import http from 'node:http'
import { createApp } from './api/http/index.js'
import {
  buildContainer,
  disconnectPrisma,
  disconnectRedis,
  env,
  getRedis,
  logger,
  prisma,
} from './core/index.js'
import { attachSocketIO, emitDataUpdated } from './modules/realtime/index.js'

async function main() {
  await prisma.$connect()
  getRedis()

  const realtimeRef: {
    emit: (detail?: { entity?: 'sprint' | 'submission' | 'user' }) => void
  } = { emit: () => {} }

  const container = buildContainer(prisma, {
    notifyDataUpdated: (detail) => realtimeRef.emit(detail),
  })

  const app = createApp({ prisma, container })
  const httpServer = http.createServer(app)
  const io = attachSocketIO(httpServer)
  realtimeRef.emit = (detail) => emitDataUpdated(io, { source: 'bff', ...detail })

  httpServer.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'BFF listening (HTTP + Socket.io)')
  })

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down')
    await new Promise<void>((resolve) => {
      io.close(() => resolve())
    })
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => (err ? reject(err) : resolve()))
    })
    logger.info('HTTP server closed')
    await disconnectPrisma()
    await disconnectRedis()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  logger.fatal({ err: error }, 'Fatal error on startup')
  process.exit(1)
})
