import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../errors/AppError.js'

/**
 * After `requireAuth`: only ADMIN may use `/api/v1/admin`.
 * USER → 403.
 */
export function requireAdminArea(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth) {
    return next(AppError.unauthorized('Missing authentication'))
  }
  if (req.auth.role !== 'ADMIN') {
    return next(AppError.forbidden('Insufficient permissions for this admin resource'))
  }
  next()
}
