import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Socket } from 'socket.io'
import { dropIfSessionDead } from '../../src/realtime/socketServer.js'
import {
  _resetSessionStoreForTests,
  registerSession,
  revokeSession,
} from '../../src/services/sessionStore.js'
import { setRedisForTests } from '../../src/infra/redis.js'

beforeEach(() => {
  setRedisForTests(null)
  _resetSessionStoreForTests()
})

function makeFakeSocket(jti: string | undefined) {
  const emit = vi.fn()
  const disconnect = vi.fn()
  const socket = {
    id: 's1',
    data: { jti } as Record<string, unknown>,
    emit,
    disconnect,
  } as unknown as Socket
  return { socket, emit, disconnect }
}

describe('socket re-auth (dropIfSessionDead)', () => {
  it('keeps connection when session is still active', async () => {
    await registerSession('j-active', 60)
    const { socket, disconnect } = makeFakeSocket('j-active')
    const dead = await dropIfSessionDead(socket)
    expect(dead).toBe(false)
    expect(disconnect).not.toHaveBeenCalled()
  })

  it('disconnects and emits AUTH_REVOKED when session was revoked (logout)', async () => {
    await registerSession('j-stale', 60)
    await revokeSession('j-stale')
    const { socket, disconnect, emit } = makeFakeSocket('j-stale')
    const dead = await dropIfSessionDead(socket)
    expect(dead).toBe(true)
    expect(emit).toHaveBeenCalledWith('AUTH_REVOKED')
    expect(disconnect).toHaveBeenCalledWith(true)
  })

  it('disconnects when socket has no jti at all', async () => {
    const { socket, disconnect } = makeFakeSocket(undefined)
    const dead = await dropIfSessionDead(socket)
    expect(dead).toBe(true)
    expect(disconnect).toHaveBeenCalled()
  })
})
