import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { env } from '../config/env.js'
import { verifyAccessToken } from '../middleware/auth.js'
import { isSessionActive } from '../services/sessionStore.js'
import { logger } from '../infra/logger.js'
import type { DataUpdatedPayload } from '../shared/types/index.js'

export const DATA_UPDATED_EVENT = 'DATA_UPDATED' as const

// Период повторной проверки сессии для уже подключённого сокета.
// Достаточно агрессивно, чтобы logout/revoke на бэке не оставляли «зомби»-соединения надолго.
export const SOCKET_REAUTH_INTERVAL_MS = 30_000

export async function dropIfSessionDead(socket: Socket): Promise<boolean> {
  const jti = socket.data.jti as string | undefined
  if (!jti) {
    socket.disconnect(true)
    return true
  }
  if (!(await isSessionActive(jti))) {
    logger.debug({ socketId: socket.id, jti }, 'socket session revoked, disconnecting')
    socket.emit('AUTH_REVOKED')
    socket.disconnect(true)
    return true
  }
  return false
}

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
      socket.data.jti = claims.jti
      return next()
    } catch {
      return next(new Error('UNAUTHORIZED'))
    }
  })

  io.on('connection', (socket) => {
    logger.debug({ socketId: socket.id, userId: socket.data.userId }, 'socket connected')

    // Периодическая ре-аутентификация: если сессия отозвана через logout/refresh,
    // выкидываем сокет даже если access-token ещё формально не истёк.
    const timer = setInterval(() => {
      void dropIfSessionDead(socket)
    }, SOCKET_REAUTH_INTERVAL_MS)

    // Плюс точечная проверка на каждый входящий event — если клиент активен,
    // отзыв сработает мгновенно, без ожидания тика интервала.
    socket.use((_packet, next) => {
      void dropIfSessionDead(socket).then((dead) => {
        if (!dead) next()
      })
    })

    socket.on('disconnect', (reason) => {
      clearInterval(timer)
      logger.debug({ socketId: socket.id, reason }, 'socket disconnected')
    })
  })

  return io
}

export function emitDataUpdated(io: Server, detail: Omit<DataUpdatedPayload, 'at'> = {}) {
  const payload: DataUpdatedPayload = { ...detail, at: new Date().toISOString() }
  io.emit(DATA_UPDATED_EVENT, payload)
}
