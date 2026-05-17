/**
 * Юнит-тесты для readiness health-check.
 *
 * Мокаем Prisma и Redis: проверяем что сервис правильно агрегирует статусы
 * и отрабатывает таймаут.
 */
import { describe, expect, it } from 'vitest'
import { runHealthCheck } from '../../src/infra/health.js'

function fakePrisma(opts: { ok?: boolean; delayMs?: number } = {}) {
  return {
    async $queryRaw() {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs))
      if (opts.ok === false) throw new Error('db down')
      return [{ '?column?': 1 }]
    },
  } as never
}

function fakeRedis(opts: { ok?: boolean; delayMs?: number } = {}) {
  return {
    async ping() {
      if (opts.delayMs) await new Promise((r) => setTimeout(r, opts.delayMs))
      if (opts.ok === false) throw new Error('redis down')
      return 'PONG'
    },
  } as never
}

describe('runHealthCheck', () => {
  it('возвращает ok=true когда оба зависимых сервиса отвечают', async () => {
    const report = await runHealthCheck({
      prisma: fakePrisma({ ok: true }),
      redis: fakeRedis({ ok: true }),
      version: '2.0.0',
    })
    expect(report.ok).toBe(true)
    expect(report.deps).toEqual({ db: 'ok', redis: 'ok' })
    expect(report.version).toBe('2.0.0')
    expect(report.uptimeSec).toBeGreaterThanOrEqual(0)
  })

  it('ok=false если БД упала', async () => {
    const report = await runHealthCheck({
      prisma: fakePrisma({ ok: false }),
      redis: fakeRedis({ ok: true }),
      version: '2.0.0',
    })
    expect(report.ok).toBe(false)
    expect(report.deps.db).toBe('fail')
    expect(report.deps.redis).toBe('ok')
  })

  it('ok=false если Redis упал', async () => {
    const report = await runHealthCheck({
      prisma: fakePrisma({ ok: true }),
      redis: fakeRedis({ ok: false }),
      version: '2.0.0',
    })
    expect(report.ok).toBe(false)
    expect(report.deps.db).toBe('ok')
    expect(report.deps.redis).toBe('fail')
  })

  it('fail когда Redis вовсе не сконфигурирован (null)', async () => {
    const report = await runHealthCheck({
      prisma: fakePrisma({ ok: true }),
      redis: null,
      version: '2.0.0',
    })
    expect(report.ok).toBe(false)
    expect(report.deps.redis).toBe('fail')
  })

  it('таймаут не блокирует ответ дольше CHECK_TIMEOUT_MS', async () => {
    const start = Date.now()
    const report = await runHealthCheck({
      // 3 секунды — должно отвалиться по таймауту 1 сек
      prisma: fakePrisma({ delayMs: 3000 }),
      redis: fakeRedis({ ok: true }),
      version: '2.0.0',
    })
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(2000)
    expect(report.deps.db).toBe('fail')
  }, 5000)
})
