import pino, { type Logger } from 'pino'
import { env } from '../config/env.js'

const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-dev-register-key"]',
  'req.body.password',
  'req.body.passwordHash',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.accessToken',
  '*.refreshToken',
]

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: redactPaths, censor: '[REDACTED]' },
  base: { service: 'basalt-bff' },
  transport:
    env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:standard' } }
      : undefined,
})
