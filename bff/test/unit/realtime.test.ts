/**
 * Юнит-тесты для realtime-логики: таргетированный emit и broadcast.
 *
 * Используем `socket.io` + `socket.io-client` на ephemeral порту,
 * без http-сервера от Express (изолируем тест от всего остального).
 *
 * Это полноценный integration-style тест над WebSocket, но он быстрый (< 1s)
 * и не требует Docker — поэтому держим в unit-наборе.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import http from 'node:http'
import { type AddressInfo } from 'node:net'
import { Server } from 'socket.io'
import { io as Client, type Socket as ClientSocket } from 'socket.io-client'
import {
  DATA_UPDATED_EVENT,
  USER_EVENTS,
  emitDataUpdated,
  emitToUser,
} from '../../src/realtime/socketServer.js'

describe('realtime emit', () => {
  let httpServer: http.Server
  let io: Server
  let port: number
  let userA: ClientSocket | null = null
  let userB: ClientSocket | null = null

  beforeEach(async () => {
    httpServer = http.createServer()
    io = new Server(httpServer)
    // Без аутентификации в тесте: вручную джойним сокет в комнату user:<id>.
    io.on('connection', (socket) => {
      const userId = socket.handshake.auth?.userId as string | undefined
      if (userId) socket.join(`user:${userId}`)
    })
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port
        resolve()
      })
    })
  })

  afterEach(async () => {
    userA?.disconnect()
    userB?.disconnect()
    io.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  })

  it('emitDataUpdated рассылает всем подключённым клиентам', async () => {
    userA = Client(`http://localhost:${port}`, { auth: { userId: 'user-a' } })
    userB = Client(`http://localhost:${port}`, { auth: { userId: 'user-b' } })

    await Promise.all([
      new Promise<void>((r) => userA!.on('connect', () => r())),
      new Promise<void>((r) => userB!.on('connect', () => r())),
    ])

    const receivedA: unknown[] = []
    const receivedB: unknown[] = []
    userA.on(DATA_UPDATED_EVENT, (p) => receivedA.push(p))
    userB.on(DATA_UPDATED_EVENT, (p) => receivedB.push(p))

    emitDataUpdated(io, { entity: 'submission' })
    await new Promise((r) => setTimeout(r, 50))

    expect(receivedA).toHaveLength(1)
    expect(receivedB).toHaveLength(1)
  })

  it('emitToUser отправляет ТОЛЬКО владельцу комнаты', async () => {
    userA = Client(`http://localhost:${port}`, { auth: { userId: 'user-a' } })
    userB = Client(`http://localhost:${port}`, { auth: { userId: 'user-b' } })

    await Promise.all([
      new Promise<void>((r) => userA!.on('connect', () => r())),
      new Promise<void>((r) => userB!.on('connect', () => r())),
    ])

    const receivedA: unknown[] = []
    const receivedB: unknown[] = []
    userA.on(USER_EVENTS.SUBMISSION_REVIEWED, (p) => receivedA.push(p))
    userB.on(USER_EVENTS.SUBMISSION_REVIEWED, (p) => receivedB.push(p))

    emitToUser(io, 'user-a', USER_EVENTS.SUBMISSION_REVIEWED, {
      submissionId: 'sub-1',
      status: 'ACCEPTED',
      mentorScore: 95,
    })
    await new Promise((r) => setTimeout(r, 50))

    expect(receivedA).toHaveLength(1)
    expect(receivedB).toHaveLength(0)

    const payload = receivedA[0] as { status: string; mentorScore: number; at: string }
    expect(payload.status).toBe('ACCEPTED')
    expect(payload.mentorScore).toBe(95)
    expect(typeof payload.at).toBe('string') // server-stamped timestamp
  })

  it('emitToUser несуществующему пользователю — никому не уходит, без ошибок', async () => {
    userA = Client(`http://localhost:${port}`, { auth: { userId: 'user-a' } })
    await new Promise<void>((r) => userA!.on('connect', () => r()))

    const receivedA: unknown[] = []
    userA.on(USER_EVENTS.ACHIEVEMENT_GRANTED, (p) => receivedA.push(p))

    expect(() =>
      emitToUser(io, 'no-such-user', USER_EVENTS.ACHIEVEMENT_GRANTED, { slug: 'first_step' })
    ).not.toThrow()

    await new Promise((r) => setTimeout(r, 50))
    expect(receivedA).toHaveLength(0)
  })
})
