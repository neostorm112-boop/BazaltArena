import { beforeEach, describe, expect, it } from 'vitest'
import { createAuthService } from '../../src/services/authService.js'
import { AppError } from '../../src/errors/AppError.js'
import { _resetSessionStoreForTests, isSessionActive } from '../../src/services/sessionStore.js'
import { setRedisForTests } from '../../src/infra/redis.js'
import { makeInMemoryUserRepo, makeUser } from './helpers.js'

const FAKE_HASH = 'fake-hash'

const fakeHash = async (raw: string) => `${FAKE_HASH}:${raw}`
const fakeVerify = async (hash: string, raw: string) => hash === `${FAKE_HASH}:${raw}`

beforeEach(() => {
  setRedisForTests(null)
  _resetSessionStoreForTests()
})

describe('authService.register', () => {
  it('creates a user, hashes password and emits both tokens', async () => {
    const users = makeInMemoryUserRepo()
    const service = createAuthService({ users, hashPassword: fakeHash, verifyPassword: fakeVerify })

    const result = await service.register({
      email: 'New@Example.com',
      handle: '@new_user',
      password: 'password123',
      devKey: undefined,
    })

    expect(result.user.handle).toBe('new_user')
    expect(result.accessToken).toBeTruthy()
    expect(result.refreshToken).toBeTruthy()
    expect(result.accessToken).not.toBe(result.refreshToken)
    expect(await isSessionActive(result.jti)).toBe(true)

    const persisted = users.list()[0]
    expect(persisted.email).toBe('new@example.com')
    expect(persisted.passwordHash).toBe(`${FAKE_HASH}:password123`)
  })

  it('rejects duplicate email with conflict', async () => {
    const users = makeInMemoryUserRepo([
      makeUser({ id: 'u_a', email: 'taken@example.com', handle: 'a' }),
    ])
    const service = createAuthService({ users, hashPassword: fakeHash, verifyPassword: fakeVerify })

    await expect(
      service.register({
        email: 'taken@example.com',
        handle: 'fresh',
        password: 'password123',
        devKey: undefined,
      })
    ).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('honors devRegisterKey when configured', async () => {
    const users = makeInMemoryUserRepo()
    const service = createAuthService({
      users,
      hashPassword: fakeHash,
      verifyPassword: fakeVerify,
      devRegisterKey: 'secret-key',
    })

    await expect(
      service.register({
        email: 'a@b.c',
        handle: 'hh',
        password: 'password123',
        devKey: 'wrong',
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    await expect(
      service.register({
        email: 'a@b.c',
        handle: 'hh',
        password: 'password123',
        devKey: 'secret-key',
      })
    ).resolves.toBeTruthy()
  })
})

describe('authService.login', () => {
  it('issues tokens on matching credentials', async () => {
    const users = makeInMemoryUserRepo([
      makeUser({
        id: 'u_1',
        email: 'alice@example.com',
        handle: 'alice',
        passwordHash: `${FAKE_HASH}:correct-horse`,
      }),
    ])
    const service = createAuthService({ users, hashPassword: fakeHash, verifyPassword: fakeVerify })

    const result = await service.login({
      loginOrEmail: 'alice@example.com',
      password: 'correct-horse',
    })
    expect(result.user.id).toBe('u_1')
    expect(await isSessionActive(result.jti)).toBe(true)
  })

  it('rejects unknown user with INVALID_CREDENTIALS (no leakage)', async () => {
    const users = makeInMemoryUserRepo()
    const service = createAuthService({ users, hashPassword: fakeHash, verifyPassword: fakeVerify })
    await expect(
      service.login({ loginOrEmail: 'ghost@example.com', password: 'whatever' })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      service.login({ loginOrEmail: 'ghost@example.com', password: 'whatever' })
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  })

  it('rejects wrong password without revealing which field was wrong', async () => {
    const users = makeInMemoryUserRepo([
      makeUser({ email: 'a@b.c', passwordHash: `${FAKE_HASH}:right` }),
    ])
    const service = createAuthService({ users, hashPassword: fakeHash, verifyPassword: fakeVerify })
    await expect(service.login({ loginOrEmail: 'a@b.c', password: 'wrong' })).rejects.toMatchObject(
      { code: 'INVALID_CREDENTIALS' }
    )
  })
})

describe('authService.refresh & logout', () => {
  it('rotates jti and invalidates the old session', async () => {
    const users = makeInMemoryUserRepo([
      makeUser({ id: 'u_1', email: 'a@b.c', passwordHash: `${FAKE_HASH}:pw` }),
    ])
    const service = createAuthService({ users, hashPassword: fakeHash, verifyPassword: fakeVerify })
    const initial = await service.login({ loginOrEmail: 'a@b.c', password: 'pw' })
    const refreshed = await service.refresh({ refreshToken: initial.refreshToken })

    expect(refreshed.jti).not.toBe(initial.jti)
    expect(await isSessionActive(initial.jti)).toBe(false)
    expect(await isSessionActive(refreshed.jti)).toBe(true)
  })

  it('logout marks current session as inactive', async () => {
    const users = makeInMemoryUserRepo([
      makeUser({ id: 'u_1', email: 'a@b.c', passwordHash: `${FAKE_HASH}:pw` }),
    ])
    const service = createAuthService({ users, hashPassword: fakeHash, verifyPassword: fakeVerify })
    const tokens = await service.login({ loginOrEmail: 'a@b.c', password: 'pw' })
    await service.logout(tokens.jti)
    expect(await isSessionActive(tokens.jti)).toBe(false)
  })

  it('refresh rejects an unknown jti (already logged out)', async () => {
    const users = makeInMemoryUserRepo([
      makeUser({ id: 'u_1', email: 'a@b.c', passwordHash: `${FAKE_HASH}:pw` }),
    ])
    const service = createAuthService({ users, hashPassword: fakeHash, verifyPassword: fakeVerify })
    const tokens = await service.login({ loginOrEmail: 'a@b.c', password: 'pw' })
    await service.logout(tokens.jti)
    await expect(service.refresh({ refreshToken: tokens.refreshToken })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    })
  })
})
