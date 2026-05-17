/**
 * Юнит-тесты для Prometheus-метрик: middleware и формата ответа.
 *
 * Полная цепочка с реальными запросами проверяется в integration-тестах.
 * Здесь — что счётчик и гистограмма реально инкрементируются и регистр отдаёт текст.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import express from 'express'
import request from 'supertest'
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  metricsMiddleware,
  metricsRegistry,
  resetMetricsForTests,
} from '../../src/infra/metrics.js'

describe('metrics middleware', () => {
  beforeEach(() => {
    resetMetricsForTests()
  })

  afterAll(() => {
    resetMetricsForTests()
  })

  it('инкрементирует http_requests_total по метке route+status', async () => {
    const app = express()
    app.use(metricsMiddleware)
    app.get('/ping', (_req, res) => res.json({ ok: true }))

    await request(app).get('/ping').expect(200)
    await request(app).get('/ping').expect(200)

    const value = await httpRequestsTotal.get()
    const sample = value.values.find(
      (v) => v.labels.route === '/ping' && v.labels.status === '200'
    )
    expect(sample?.value).toBe(2)
  })

  it('записывает гистограмму latency', async () => {
    const app = express()
    app.use(metricsMiddleware)
    app.get('/slow', (_req, res) => res.json({ ok: true }))

    await request(app).get('/slow').expect(200)

    const value = await httpRequestDurationSeconds.get()
    const count = value.values.find(
      (v) => v.labels.route === '/slow' && v.metricName?.endsWith('_count')
    )
    expect(count?.value).toBeGreaterThanOrEqual(1)
  })

  it('use "unknown" route label если запрос не попал в роутер', async () => {
    const app = express()
    app.use(metricsMiddleware)
    // Никакого роута — 404
    app.use((_req, res) => res.status(404).json({ code: 'NOT_FOUND' }))

    await request(app).get('/no-such-path').expect(404)

    const value = await httpRequestsTotal.get()
    const sample = value.values.find(
      (v) => v.labels.route === 'unknown' && v.labels.status === '404'
    )
    expect(sample?.value).toBe(1)
  })

  it('registry отдаёт текст в формате Prometheus', async () => {
    const app = express()
    app.use(metricsMiddleware)
    app.get('/ok', (_req, res) => res.json({ ok: true }))
    await request(app).get('/ok').expect(200)

    const text = await metricsRegistry.metrics()
    expect(text).toContain('# TYPE http_requests_total counter')
    expect(text).toContain('# TYPE http_request_duration_seconds histogram')
    expect(text).toContain('service="basalt-bff"')
  })
})
