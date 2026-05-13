import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'
import { isSessionActive } from '../services/sessionStore.js'
import type { UserRole } from '@prisma/client'

export interface AuthClaims {
  sub: string
  jti: string
  role: UserRole
  typ?: 'access' | 'refresh'
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthClaims
  }
}

export function verifyAccessToken(token: string): AuthClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
    }) as AuthClaims
    if (!decoded.sub || !decoded.jti) throw new Error('Malformed token')
    if (decoded.typ && decoded.typ !== 'access') throw new Error('Wrong token type')
    return decoded
  } catch {
    throw AppError.unauthorized('Invalid or expired access token')
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization
    if (!header?.startsWith('Bearer ')) {
      throw AppError.unauthorized('Missing bearer token')
    }
    const claims = verifyAccessToken(header.slice(7))
    const sessionActive = await isSessionActive(claims.jti)
    if (!sessionActive) {
      throw AppError.unauthorized('Session revoked')
    }
    req.auth = claims
    next()
  } catch (error) {
    if (error instanceof AppError) {
      next(error)
      return
    }
    req.log?.error({ err: error }, 'requireAuth unexpected failure')
    next(AppError.internal('Could not verify session'))
  }
}

export function requireRole(...allowed: UserRole[]) {
  return function rolesGuard(req: Request, _res: Response, next: NextFunction) {
    if (!req.auth) return next(AppError.unauthorized())
    if (!allowed.includes(req.auth.role)) return next(AppError.forbidden('Insufficient role'))
    next()
  }
}
