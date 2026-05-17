import type { Logger } from 'pino'
import { logger as defaultLogger } from './logger.js'

export type SafeAuditContext = {
  action?: string
  actorId?: string
  [key: string]: unknown
}

/**
 * Runs an audit (or other best-effort side effect) without breaking the surrounding
 * business operation. Errors are routed to pino as `logger.error` with the supplied
 * context so a failed audit is recorded instead of silently dropped.
 */
export async function safeAudit(
  fn: () => Promise<unknown>,
  context: SafeAuditContext = {},
  log: Pick<Logger, 'error'> = defaultLogger
): Promise<void> {
  try {
    await fn()
  } catch (err) {
    log.error({ err, ...context }, 'audit log failed')
  }
}
