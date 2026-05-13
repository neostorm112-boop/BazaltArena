import type { NextFunction, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { AppError } from '../errors/AppError.js'

interface ErrorBody {
  code: string
  message: string
  requestId: string
  details?: unknown
}

function mapError(error: unknown, req: Request): { status: number; body: ErrorBody } | null {
  const requestId = req.requestId

  if (error instanceof ZodError) {
    req.log?.warn({ err: error.issues }, 'Validation failed')
    return {
      status: 400,
      body: {
        code: 'VALIDATION_ERROR',
        message: 'Request payload failed validation',
        details: error.flatten(),
        requestId,
      },
    }
  }

  if (error instanceof AppError) {
    const logLevel = error.status >= 500 ? 'error' : 'warn'
    req.log?.[logLevel]({ err: error }, 'Handled AppError')
    return {
      status: error.status,
      body: {
        code: error.code,
        message: error.message,
        details: error.details,
        requestId,
      },
    }
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    req.log?.error({ err: error }, 'Prisma failed to connect to the database')
    return {
      status: 503,
      body: {
        code: 'DATABASE_UNAVAILABLE',
        message:
          'Сервер не может подключиться к базе данных. Запустите Postgres (например `docker compose up postgres`) и проверьте DATABASE_URL (для хоста с Docker обычно порт 5433).',
        requestId,
      },
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021') {
      req.log?.error({ err: error }, 'Prisma: referenced table missing')
      return {
        status: 503,
        body: {
          code: 'DATABASE_SCHEMA',
          message:
            'Таблицы в базе не созданы. В каталоге bff выполните: npx prisma migrate deploy (или prisma migrate dev).',
          requestId,
        },
      }
    }
    if (error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target)
        ? (error.meta!.target as string[]).join(',')
        : String(error.meta?.target ?? 'value')
      req.log?.warn({ err: error }, 'Prisma unique constraint conflict')
      return {
        status: 409,
        body: { code: 'CONFLICT', message: `Duplicate ${target}`, requestId },
      }
    }
    if (error.code === 'P2025') {
      req.log?.warn({ err: error }, 'Prisma not found')
      return { status: 404, body: { code: 'NOT_FOUND', message: 'Record not found', requestId } }
    }
    req.log?.warn({ err: error }, 'Prisma known request error')
    return {
      status: 400,
      body: {
        code: 'DATABASE_ERROR',
        message:
          'Не удалось выполнить запрос к базе данных. Проверьте логи сервера и состояние БД.',
        requestId,
      },
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    req.log?.warn({ err: error }, 'Prisma validation error')
    return {
      status: 400,
      body: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid data for database operation',
        requestId,
      },
    }
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    req.log?.error({ err: error }, 'Prisma unknown request error')
    return {
      status: 503,
      body: { code: 'SERVICE_UNAVAILABLE', message: 'Database temporarily unavailable', requestId },
    }
  }

  if (error instanceof SyntaxError && error instanceof Error && 'body' in error) {
    req.log?.warn({ err: error }, 'Malformed JSON body')
    return {
      status: 400,
      body: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON', requestId },
    }
  }

  return null
}

export function errorHandler() {
  return function errorMiddleware(
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
  ) {
    try {
      const mapped = mapError(error, req)
      if (mapped) {
        return res.status(mapped.status).json(mapped.body)
      }

      const isError = error instanceof Error
      req.log?.error(
        { err: isError ? { message: error.message, stack: error.stack } : error },
        'Unhandled error'
      )
      const body: ErrorBody = {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        requestId: req.requestId,
      }
      return res.status(500).json(body)
    } catch (fatal) {
      const rid = typeof req.requestId === 'string' ? req.requestId : 'unknown'
      const log = req.log ?? console
      log.error({ err: fatal }, 'Error handler failed')
      if (!res.headersSent) {
        res
          .status(500)
          .json({ code: 'INTERNAL_ERROR', message: 'Internal server error', requestId: rid })
      }
    }
  }
}
