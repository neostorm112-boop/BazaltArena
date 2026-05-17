import { describe, expect, it, vi } from 'vitest'
import { safeAudit } from '../../src/infra/safeAudit.js'

function makeLog() {
  return { error: vi.fn() }
}

describe('safeAudit', () => {
  it('swallows audit errors so the surrounding business op is not blocked', async () => {
    const log = makeLog()
    const business = vi.fn()

    await safeAudit(
      async () => {
        throw new Error('db down')
      },
      { action: 'USER_PATCH', actorId: 'u_1' },
      log
    )

    business()
    expect(business).toHaveBeenCalledTimes(1)
  })

  it('logs the failure via pino.error with the supplied context', async () => {
    const log = makeLog()
    const boom = new Error('db down')

    await safeAudit(
      async () => {
        throw boom
      },
      { action: 'SPRINT_CREATE', actorId: 'admin_1' },
      log
    )

    expect(log.error).toHaveBeenCalledTimes(1)
    const [payload, msg] = log.error.mock.calls[0]
    expect(payload).toMatchObject({
      err: boom,
      action: 'SPRINT_CREATE',
      actorId: 'admin_1',
    })
    expect(msg).toBe('audit log failed')
  })

  it('does not log when the audit succeeds', async () => {
    const log = makeLog()
    const fn = vi.fn().mockResolvedValue(undefined)

    await safeAudit(fn, { action: 'AUTH_LOGIN' }, log)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(log.error).not.toHaveBeenCalled()
  })

  it('resolves to undefined even when audit throws', async () => {
    const log = makeLog()
    const result = await safeAudit(
      async () => {
        throw new Error('nope')
      },
      {},
      log
    )
    expect(result).toBeUndefined()
  })
})
