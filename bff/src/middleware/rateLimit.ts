import rateLimit, { type Options } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { env } from '../config/env.js'
import { getRedis } from '../infra/redis.js'

function buildStore() {
  const redis = getRedis()
  if (!redis || typeof redis.call !== 'function') return undefined
  return new RedisStore({
    // ioredis returns Promise<unknown>; rate-limit-redis expects Promise<RedisReply>.
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<never>,
    prefix: 'rl:',
  })
}

function disabledLimiter(): ReturnType<typeof rateLimit> {
  return rateLimit({
    windowMs: 60_000,
    limit: Number.MAX_SAFE_INTEGER,
    standardHeaders: true,
    legacyHeaders: false,
  })
}

function buildLimiter(name: string, overrides: Partial<Options>): ReturnType<typeof rateLimit> {
  if (env.RATE_LIMIT_DISABLED) return disabledLimiter()
  return rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    store: buildStore(),
    keyGenerator: (req) => `${name}:${req.ip}`,
    handler: (_req, res) => {
      res.status(429).json({
        code: 'RATE_LIMITED',
        message: 'Too many requests',
      })
    },
    ...overrides,
  })
}

export const loginLimiter = buildLimiter('login', { windowMs: 60_000, limit: 5 })
export const registerLimiter = buildLimiter('register', { windowMs: 60 * 60_000, limit: 3 })
export const refreshLimiter = buildLimiter('refresh', { windowMs: 60_000, limit: 30 })
export const likeLimiter = buildLimiter('like', {
  windowMs: 60_000,
  limit: 30,
  keyGenerator: (req) => `like:${req.auth?.sub ?? req.ip}`,
})
export const submissionLimiter = buildLimiter('submission', {
  windowMs: 60 * 60_000,
  limit: 30,
  keyGenerator: (req) => `submission:${req.auth?.sub ?? req.ip}`,
})
