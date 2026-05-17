/**
 * Юнит-тесты для Idempotency-Key middleware.
 *
 * Используем ioredis-mock как in-memory замену Redis.
 * Проверяем: пропуск без заголовка, валидация ключа, кэширование ответа,
 * повтор отдаёт кэш с заголовком Idempotent-Replay.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import express from 'express'
import request from 'supertest'
import RedisMock from 'ioredis-mock'
import type { Redis as RedisType } from 'ioredis'
import { idempotencyMiddleware } from '../../src/middleware/idempotency.js'
import { setRedisForTests } from '../../src/infra/redis.js'

function makeApp(handler: express.RequestHandler) {
  const app = express()
  app.use(express.json())
  app.post('/test', idempotencyMiddleware, handler)
  return app
}

describe('idempotency middleware', () => {
  beforeEach(() => {
    setRedisForTests(new (RedisMock as unknown as typeof RedisType)() as never)
  })
  afterEach(() => {
    setRedisForTests(null)
  })

  it('пропускает запрос без заголовка Idempotency-Key', async () => {
    let calls = 0
    const app = makeApp((_req, res) => {
      calls += 1
      res.status(201).json({ ok: true, calls })
    })

    const r1 = await request(app).post('/test').send({}).expect(201)
    const r2 = await request(app).post('/test').send({}).expect(201)

    expect(calls).toBe(2)
    expect(r1.body.calls).toBe(1)
    expect(r2.body.calls).toBe(2)
    expect(r2.headers['idempotent-replay']).toBeUndefined()
  })

  it('400 BAD_IDEMPOTENCY_KEY при невалидном ключе', async () => {
    const app = makeApp((_req, res) => res.json({ ok: true }))
    const res = await request(app).post('/test').set('Idempotency-Key', 'bad!@#').send({})
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('BAD_IDEMPOTENCY_KEY')
  })

  it('повторный запрос с тем же ключом отдаёт кэшированный ответ', async () => {
    let calls = 0
    const app = makeApp((_req, res) => {
      calls += 1
      res.status(201).json({ ok: true, calls })
    })

    const key = 'test-idem-key-12345'
    const r1 = await request(app).post('/test').set('Idempotency-Key', key).send({}).expect(201)
    const r2 = await request(app).post('/test').set('Idempotency-Key', key).send({}).expect(201)

    expect(calls).toBe(1)
    expect(r1.body).toEqual({ ok: true, calls: 1 })
    expect(r2.body).toEqual({ ok: true, calls: 1 })
    expect(r2.headers['idempotent-replay']).toBe('true')
  })

  it('сохраняет 4xx ответы (клиентские ошибки идемпотентны)', async () => {
    let calls = 0
    const app = makeApp((_req, res) => {
      calls += 1
      res.status(422).json({ code: 'VALIDATION_ERROR', calls })
    })

    const key = 'idem-4xx-key-999999'
    await request(app).post('/test').set('Idempotency-Key', key).send({}).expect(422)
    const r2 = await request(app).post('/test').set('Idempotency-Key', key).send({}).expect(422)

    expect(calls).toBe(1)
    expect(r2.body.calls).toBe(1)
  })

  it('НЕ кэширует 5xx — позволяет повторить запрос после серверной ошибки', async () => {
    let calls = 0
    const app = makeApp((_req, res) => {
      calls += 1
      res.status(500).json({ code: 'INTERNAL_ERROR', calls })
    })

    const key = 'idem-5xx-test-99999'
    await request(app).post('/test').set('Idempotency-Key', key).send({}).expect(500)
    const r2 = await request(app).post('/test').set('Idempotency-Key', key).send({}).expect(500)

    expect(calls).toBe(2)
    expect(r2.body.calls).toBe(2)
  })

  it('разные ключи — независимые ответы', async () => {
    let calls = 0
    const app = makeApp((_req, res) => {
      calls += 1
      res.status(201).json({ calls })
    })

    await request(app).post('/test').set('Idempotency-Key', 'aaaa1111bbbb').send({}).expect(201)
    await request(app).post('/test').set('Idempotency-Key', 'cccc2222dddd').send({}).expect(201)

    expect(calls).toBe(2)
  })

})
// Поведение fallback при отсутствии Redis сложно покрыть юнитом без env-моков —
// проверяется фактическим прохождением запроса в integration-тестах с RedisMock.
