import { createHash } from 'node:crypto'
import type { Request } from 'express'
import rateLimit, { type Options } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
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

// Checked at request time (not module load) so tests can flip the flag without
// rebuilding the middleware tree.
function isRateLimitDisabled(): boolean {
  const v = process.env.RATE_LIMIT_DISABLED
  return v === 'true' || v === '1'
}

function buildLimiter(name: string, overrides: Partial<Options>): ReturnType<typeof rateLimit> {
  const { skip: extraSkip, ...rest } = overrides
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
    ...rest,
    skip: async (req, res) => {
      if (isRateLimitDisabled()) return true
      if (extraSkip) return Boolean(await extraSkip(req, res))
      return false
    },
  })
}

function readBodyString(req: Request, field: string): string | undefined {
  const body = req.body as Record<string, unknown> | undefined
  const value = body?.[field]
  return typeof value === 'string' ? value : undefined
}

function normalizeEmail(value: string | undefined): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : undefined
}

function readEmailKey(req: Request): string | undefined {
  return normalizeEmail(readBodyString(req, 'email'))
}

function readRefreshTokenHash(req: Request): string | undefined {
  const token = readBodyString(req, 'refreshToken')
  if (!token) return undefined
  return createHash('sha256').update(token).digest('hex').slice(0, 24)
}

export const loginLimiter = buildLimiter('login', { windowMs: 60_000, limit: 5 })
export const registerLimiter = buildLimiter('register', { windowMs: 60 * 60_000, limit: 3 })
export const refreshLimiter = buildLimiter('refresh', { windowMs: 60_000, limit: 30 })

// Second-layer limiters that key on a stable identifier from the request body,
// so an attacker who rotates X-Forwarded-For still hits a wall per account.
export const loginEmailLimiter = buildLimiter('login-email', {
  windowMs: 15 * 60_000,
  limit: 10,
  keyGenerator: (req) => `login-email:${readEmailKey(req) ?? 'anonymous'}`,
  skip: (req) => readEmailKey(req) === undefined,
})

export const registerEmailLimiter = buildLimiter('register-email', {
  windowMs: 60 * 60_000,
  limit: 5,
  keyGenerator: (req) => `register-email:${readEmailKey(req) ?? 'anonymous'}`,
  skip: (req) => readEmailKey(req) === undefined,
})

export const refreshTokenLimiter = buildLimiter('refresh-token', {
  windowMs: 60_000,
  limit: 10,
  keyGenerator: (req) => `refresh-token:${readRefreshTokenHash(req) ?? 'anonymous'}`,
  skip: (req) => readRefreshTokenHash(req) === undefined,
})

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
