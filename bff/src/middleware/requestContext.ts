import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'
import type { Logger } from 'pino'
import { logger as rootLogger } from '../infra/logger.js'

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string
    log: Logger
  }
}

export function requestContext() {
  return function requestContextMiddleware(req: Request, res: Response, next: NextFunction) {
    const headerId = req.header('x-request-id')
    const requestId = headerId && /^[a-zA-Z0-9-]{8,128}$/.test(headerId) ? headerId : randomUUID()
    req.requestId = requestId
    req.log = rootLogger.child({ requestId })
    res.setHeader('x-request-id', requestId)
    next()
  }
}
