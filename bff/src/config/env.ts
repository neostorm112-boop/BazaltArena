import { existsSync } from 'node:fs'
import path from 'node:path'
import { config as loadDotenv } from 'dotenv'
import { z } from 'zod'

const cwd = process.cwd()
const envInPackage = path.resolve(cwd, '.env')
const envInRepoRoot = path.resolve(cwd, '..', '.env')
if (existsSync(envInPackage)) {
  loadDotenv({ path: envInPackage })
} else if (existsSync(envInRepoRoot)) {
  loadDotenv({ path: envInRepoRoot })
} else {
  loadDotenv()
}

const baseSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 chars'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 chars'),
  JWT_ACCESS_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(15 * 60),
  JWT_REFRESH_TTL_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 60 * 24 * 30),

  RATE_LIMIT_DISABLED: z
    .string()
    .optional()
    .transform((value) => value === 'true' || value === '1'),

  CORS_ORIGINS: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : []
    ),

  DEV_REGISTER_KEY: z.string().optional(),
})

export type AppEnv = z.infer<typeof baseSchema>

function applyDevDefaults(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (env.NODE_ENV === 'production') return env
  const isTest = env.NODE_ENV === 'test'
  const defaults: NodeJS.ProcessEnv = {
    JWT_ACCESS_SECRET: 'basalt-dev-access-secret-please-change-me-32+chars',
    JWT_REFRESH_SECRET: 'basalt-dev-refresh-secret-please-change-me-32+chars',
    DATABASE_URL: 'postgresql://basalt:basalt@127.0.0.1:5433/basalt?schema=bff',
  }
  // Only auto-attach REDIS_URL in pure development so that unit tests fall back
  // to the in-process session store and don't open sockets.
  if (!isTest) defaults.REDIS_URL = 'redis://127.0.0.1:6379'
  return { ...defaults, ...env }
}

export function loadEnv(processEnv: NodeJS.ProcessEnv = process.env): AppEnv {
  const merged = applyDevDefaults(processEnv)
  const result = baseSchema.safeParse(merged)
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  - ')
    throw new Error(`Invalid environment configuration:\n  - ${issues}`)
  }
  const isProd = result.data.NODE_ENV === 'production'
  if (isProd && result.data.RATE_LIMIT_DISABLED) {
    throw new Error('RATE_LIMIT_DISABLED must not be set in production')
  }
  if (isProd && !result.data.REDIS_URL) {
    throw new Error('REDIS_URL is required in production')
  }

  let corsOrigins = [...result.data.CORS_ORIGINS]
  if (corsOrigins.length === 0) {
    if (isProd) {
      throw new Error(
        'CORS_ORIGINS is required in production: set a comma-separated allow-list (empty is not allowed; reflective wildcard was removed).'
      )
    }
    corsOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ]
  }

  return { ...result.data, CORS_ORIGINS: corsOrigins }
}

export const env = loadEnv()
