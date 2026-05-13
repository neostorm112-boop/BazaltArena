import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { io } from 'socket.io-client'
import { getAdminAccessToken } from '../api.js'

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
 * Live sync for admin UI: any `DATA_UPDATED` from BFF invalidates all `['admin', …]` queries
 * so another mentor’s changes appear without manual refresh.
 */
export function AdminSocketSync() {
  const qc = useQueryClient()
  const { pathname } = useLocation()
  const socketRef = useRef(null)

  useEffect(() => {
    const onLoginPage = pathname === '/login'
    const token = getAdminAccessToken()

    if (onLoginPage || !token) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    const socket = io(socketBaseUrl(), {
      path: '/socket.io/',
      auth: { token },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    /** @param {DataUpdatedPayload} _payload */
    const onDataUpdated = (_payload) => {
      void qc.invalidateQueries({
        predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === 'admin',
      })
    }

    socket.on(DATA_UPDATED, onDataUpdated)

    return () => {
      socket.off(DATA_UPDATED, onDataUpdated)
      socket.disconnect()
      if (socketRef.current === socket) socketRef.current = null
    }
  }, [pathname, qc])

  return null
}
