import { useQueryClient } from '@tanstack/react-query'
import { useContext, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { getStoredToken } from '../api/basaltApi.js'
import { AuthContext } from '../auth/context.js'
import { queryKeys } from '../lib/queryKeys.js'

/** Must match `bff/src/realtime/socketServer.ts` */
const DATA_UPDATED = 'DATA_UPDATED'
/** @typedef {import('../../../shared/types/contracts').DataUpdatedPayload} DataUpdatedPayload */

function socketBaseUrl() {
  const raw = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()
  if (raw) {
    try {
      return new URL(raw).origin
    } catch {
      /* fall through */
    }
  }
  return window.location.origin
}

/**
 * Синхронизация с BFF: при изменениях в админке (и метриках после сабмита/лайка)
 * приходит `DATA_UPDATED` — сразу обновляем профиль и зал славы без ручного F5.
 */
export function SocketSync() {
  const queryClient = useQueryClient()
  const auth = useContext(AuthContext)
  /** Только после успешного `/me` — иначе при протухшем токене клиент долбил бы ws:// и засорял консоль. */
  const sessionOk = Boolean(auth?.user)
  const socketRef = useRef(null)
  const lastConnectErrorAt = useRef(0)

  useEffect(() => {
    const token = getStoredToken()
    if (!sessionOk || !token) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    const socket = io(socketBaseUrl(), {
      path: '/socket.io/',
      auth: { token },
      transports: ['polling', 'websocket'],
      autoConnect: false,
      reconnectionAttempts: 12,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30_000,
      randomizationFactor: 0.5,
      timeout: 20_000,
    })
    socketRef.current = socket

    let connectErrorStreak = 0
    const maxConnectErrorsBeforeStop = 8

    /** @param {DataUpdatedPayload} _payload */
    const onDataUpdated = (_payload) => {
      if (!socket.connected) return
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() })
      void queryClient.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'hall',
      })
    }

    const onConnect = () => {
      connectErrorStreak = 0
    }

    const onConnectError = (err) => {
      connectErrorStreak += 1
      if (connectErrorStreak >= maxConnectErrorsBeforeStop) {
        socket.io.reconnection(false)
        socket.disconnect()
      }
      if (!import.meta.env.DEV) return
      const now = Date.now()
      if (now - lastConnectErrorAt.current < 12_000) return
      lastConnectErrorAt.current = now
      console.warn(
        '[SocketSync] socket.io: нет соединения с BFF (проверьте, что API на :3001 запущен и Vite проксирует /socket.io).',
        err?.message ?? err
      )
    }

    socket.on('connect', onConnect)
    socket.on(DATA_UPDATED, onDataUpdated)
    socket.on('connect_error', onConnectError)
    queueMicrotask(() => {
      if (socketRef.current === socket) socket.connect()
    })

    return () => {
      socket.io.reconnection(false)
      socket.off('connect', onConnect)
      socket.off(DATA_UPDATED, onDataUpdated)
      socket.off('connect_error', onConnectError)
      socket.disconnect()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [sessionOk, queryClient])

  return null
}
