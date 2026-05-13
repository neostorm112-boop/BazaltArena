import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import { env } from '../config/env.js'
import { verifyAccessToken } from '../middleware/auth.js'
import { isSessionActive } from '../services/sessionStore.js'
import { logger } from '../infra/logger.js'
import type { DataUpdatedPayload } from '../shared/types/index.js'

export const DATA_UPDATED_EVENT = 'DATA_UPDATED' as const

/**
 * WebSocket server on the same HTTP port as Express.
 * Clients must send `handshake.auth.token` (access JWT); same rules as REST Bearer.
 */
export function attachSocketIO(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGINS,
      credentials: true,
    },
  })

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (typeof token !== 'string' || !token.trim()) {
        return next(new Error('AUTH_REQUIRED'))
      }
      const claims = verifyAccessToken(token)
      if (!(await isSessionActive(claims.jti))) {
        return next(new Error('SESSION_REVOKED'))
      }
      socket.data.userId = claims.sub
      return next()
    } catch {
      return next(new Error('UNAUTHORIZED'))
    }
  })

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id, userId: socket.data.userId }, 'socket connected')
    socket.on('disconnect', (reason) => {
      logger.debug({ socketId: socket.id, reason }, 'socket disconnected')
    })
  })

  return io
}

export function emitDataUpdated(io: Server, detail: Omit<DataUpdatedPayload, 'at'> = {}) {
  const payload: DataUpdatedPayload = { ...detail, at: new Date().toISOString() }
  io.emit(DATA_UPDATED_EVENT, payload)
}
