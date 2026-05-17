/**
 * Prometheus-метрики для BFF.
 *
 * Эндпоинт: GET /metrics  → text/plain в формате Prometheus.
 *
 * Что собираем:
 *  - default Node.js метрики (CPU, heap, event loop lag, GC) через `collectDefaultMetrics`
 *  - http_requests_total{method,route,status} — счётчик всех запросов
 *  - http_request_duration_seconds{method,route,status} — гистограмма latency
 *
 * `route` — это шаблон express-роутинга (например `/api/v1/sprints/:id`),
 * а не конкретный URL. Это держит cardinality метрик ограниченной.
 */
import type { Request, Response, NextFunction } from 'express'
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client'

export const metricsRegistry = new Registry()
metricsRegistry.setDefaultLabels({ service: 'basalt-bff' })

collectDefaultMetrics({ register: metricsRegistry })

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests, by route, method, and status',
  labelNames: ['method', 'route', 'status'] as const,
  registers: [metricsRegistry],
})

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds',
  labelNames: ['method', 'route', 'status'] as const,
  // Бакеты от 5ms до 5s — типичный диапазон для REST API.
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
})

/**
 * Middleware: засекает время и записывает метрики в `finish`.
 * Использует `req.route?.path` или `req.baseUrl + req.route?.path`,
 * чтобы не плодить лейблы из URL с id'ами.
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint()
  res.on('finish', () => {
    const end = process.hrtime.bigint()
    const durationSec = Number(end - start) / 1e9

    const routePath = req.route?.path ?? ''
    const route = routePath ? `${req.baseUrl ?? ''}${routePath}` : 'unknown'
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode),
    }
    httpRequestsTotal.inc(labels)
    httpRequestDurationSeconds.observe(labels, durationSec)
  })
  next()
}

/**
 * Сбрасывает реестр метрик (для тестов).
 * Default-метрики не пересоздаём, потому что они привязаны к процессу.
 */
export function resetMetricsForTests(): void {
  httpRequestsTotal.reset()
  httpRequestDurationSeconds.reset()
}
