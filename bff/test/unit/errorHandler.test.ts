import { describe, expect, it, vi } from 'vitest'
import express, { type Request } from 'express'
import request from 'supertest'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { AppError } from '../../src/errors/AppError.js'
import { errorHandler } from '../../src/middleware/errorHandler.js'
import { requestContext } from '../../src/middleware/requestContext.js'

function buildApp(handler: express.RequestHandler) {
  const app = express()
  app.use(express.json())
  app.use(requestContext())
  app.get('/boom', handler)
  app.use(errorHandler())
  return app
}

function buildAppWithLog(handler: express.RequestHandler, log: Record<string, unknown>) {
  const app = express()
  app.use(express.json())
  app.use(requestContext())
  app.use((req, _res, next) => {
    ;(req as Request).log = log as unknown as Request['log']
    next()
  })
  app.get('/boom', handler)
  app.use(errorHandler())
  return app
}

describe('errorHandler middleware', () => {
  it('maps AppError to its status and code', async () => {
    const app = buildApp((_req, _res, next) => next(AppError.forbidden('nope')))
    const res = await request(app).get('/boom')
    expect(res.status).toBe(403)
    expect(res.body).toMatchObject({ code: 'FORBIDDEN', message: 'nope' })
    expect(res.body.requestId).toBeTypeOf('string')
  })

  it('maps ZodError to 400 VALIDATION_ERROR', async () => {
    const app = buildApp((_req, _res, next) => {
      try {
        z.object({ q: z.string() }).parse({})
      } catch (err) {
        next(err)
      }
    })
    const res = await request(app).get('/boom')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(res.body.details).toBeTruthy()
  })

  it('maps Prisma P2002 to 409 CONFLICT_UNIQUE without leaking field name', async () => {
    const log = { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }
    const app = buildAppWithLog((_req, _res, next) => {
      const err = new Prisma.PrismaClientKnownRequestError('conflict', {
        code: 'P2002',
        clientVersion: '5',
        meta: { target: ['email', 'handle'] },
      })
      next(err)
    }, log)
    const res = await request(app).get('/boom')
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CONFLICT_UNIQUE')
    expect(res.body.message).toBe('Resource already exists')
    // No meta/target/field name should leak in the HTTP body.
    const serialized = JSON.stringify(res.body)
    expect(serialized).not.toContain('email')
    expect(serialized).not.toContain('handle')
    expect(res.body).not.toHaveProperty('meta')
    // The field name is recorded internally via pino for debugging.
    expect(log.warn).toHaveBeenCalledTimes(1)
    const [meta, msg] = log.warn.mock.calls[0]
    expect(msg).toBe('Prisma unique constraint conflict')
    expect(meta).toMatchObject({ target: 'email,handle' })
  })

  it('hides internal errors as INTERNAL_ERROR with no stack', async () => {
    const app = buildApp((_req, _res, next) => next(new Error('database is on fire')))
    const res = await request(app).get('/boom')
    expect(res.status).toBe(500)
    expect(res.body.code).toBe('INTERNAL_ERROR')
    expect(res.body.message).toBe('Internal server error')
    expect(JSON.stringify(res.body)).not.toContain('database is on fire')
  })

  it('maps PrismaClientValidationError to 400 VALIDATION_ERROR', async () => {
    const app = buildApp((_req, _res, next) => {
      const err = new Prisma.PrismaClientValidationError('invalid', { clientVersion: '5' })
      next(err)
    })
    const res = await request(app).get('/boom')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(res.body.message).toBe('Invalid data for database operation')
  })

  it('maps malformed JSON on POST to 400', async () => {
    const app = express()
    app.use(express.json())
    app.use(requestContext())
    app.post('/echo', (req, res) => res.json(req.body))
    app.use(errorHandler())
    const res = await request(app)
      .post('/echo')
      .set('Content-Type', 'application/json')
      .send('{not json')
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('VALIDATION_ERROR')
    expect(res.body.message).toBe('Request body must be valid JSON')
  })
})
