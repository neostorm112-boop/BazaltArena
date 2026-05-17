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
 * Таргетированные user-события — приходят только владельцу решения.
 * Используются для live-обновления UI без F5: новые статус/комментарий ментора, лайки.
 */
export const USER_EVENTS = {
  SUBMISSION_REVIEWED: 'submission:reviewed',
  ACHIEVEMENT_GRANTED: 'achievement:granted',
  SOLUTION_LIKED: 'solution:liked',
} as const

export type UserEvent = (typeof USER_EVENTS)[keyof typeof USER_EVENTS]

/** Имя приватной комнаты для конкретного пользователя. */
function userRoom(userId: string): string {
  return `user:${userId}`
}

/**
 * WebSocket server на том же HTTP-порту что Express.
 * Клиент шлёт `handshake.auth.token` (access JWT); проверки как для REST Bearer.
 *
 * При успешной аутентификации сокет автоматически входит в комнату `user:<userId>`,
 * чтобы можно было слать таргетированные события через `emitToUser()`.
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
    const userId = socket.data.userId as string | undefined
    if (userId) {
      socket.join(userRoom(userId))
    }
    logger.debug({ socketId: socket.id, userId }, 'socket connected')

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

/** Broadcast всем подключённым клиентам — для обновления общих списков (зал славы, метрики). */
export function emitDataUpdated(io: Server, detail: Omit<DataUpdatedPayload, 'at'> = {}) {
  const payload: DataUpdatedPayload = { ...detail, at: new Date().toISOString() }
  io.emit(DATA_UPDATED_EVENT, payload)
}

/**
 * Таргетированная отправка событий конкретному пользователю.
 *
 * Если у пользователя несколько вкладок — событие придёт во все.
 * Если он не подключён — событие просто никуда не пойдёт (это не очередь, а pub/sub).
 */
export function emitToUser(
  io: Server,
  userId: string,
  event: UserEvent,
  payload: Record<string, unknown>
): void {
  io.to(userRoom(userId)).emit(event, { ...payload, at: new Date().toISOString() })
}
