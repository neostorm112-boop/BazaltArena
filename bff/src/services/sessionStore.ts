import { env } from '../config/env.js'
import { getRedis } from '../infra/redis.js'

const sessionKey = (jti: string) => `session:${jti}`

const memorySessions = new Map<string, number>()

function cleanupMemorySessions() {
  const now = Date.now()
  for (const [jti, expiresAt] of memorySessions) {
    if (expiresAt <= now) memorySessions.delete(jti)
  }
}

export async function registerSession(
  jti: string,
  ttlSeconds = env.JWT_REFRESH_TTL_SECONDS
): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.set(sessionKey(jti), '1', 'EX', ttlSeconds)
    return
  }
  cleanupMemorySessions()
  memorySessions.set(jti, Date.now() + ttlSeconds * 1000)
}

export async function isSessionActive(jti: string): Promise<boolean> {
  const redis = getRedis()
  if (redis) {
    const result = await redis.get(sessionKey(jti))
    return result !== null
  }
  cleanupMemorySessions()
  const expiresAt = memorySessions.get(jti)
  return typeof expiresAt === 'number' && expiresAt > Date.now()
}

export async function revokeSession(jti: string): Promise<void> {
  const redis = getRedis()
  if (redis) {
    await redis.del(sessionKey(jti))
    return
  }
  memorySessions.delete(jti)
}

export function _resetSessionStoreForTests() {
  memorySessions.clear()
}
