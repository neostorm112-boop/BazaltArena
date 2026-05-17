import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import type { UserRole } from '@prisma/client'
import { env } from '../config/env.js'
import { AppError } from '../errors/AppError.js'

export interface TokenPair {
  accessToken: string
  refreshToken: string
  jti: string
  familyId: string
  accessExpiresIn: number
  refreshExpiresIn: number
}

export function issueTokens(
  user: { id: string; role: UserRole },
  jti: string = randomUUID(),
  familyId: string = randomUUID()
): TokenPair {
  const accessToken = jwt.sign(
    { sub: user.id, jti, role: user.role, typ: 'access' },
    env.JWT_ACCESS_SECRET,
    { algorithm: 'HS256', expiresIn: env.JWT_ACCESS_TTL_SECONDS }
  )
  const refreshToken = jwt.sign(
    { sub: user.id, jti, fam: familyId, role: user.role, typ: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { algorithm: 'HS256', expiresIn: env.JWT_REFRESH_TTL_SECONDS }
  )
  return {
    accessToken,
    refreshToken,
    jti,
    familyId,
    accessExpiresIn: env.JWT_ACCESS_TTL_SECONDS,
    refreshExpiresIn: env.JWT_REFRESH_TTL_SECONDS,
  }
}

export interface RefreshClaims {
  sub: string
  jti: string
  fam: string
  role: UserRole
  typ: 'refresh'
}

export function verifyRefreshToken(token: string): RefreshClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET, {
      algorithms: ['HS256'],
    }) as RefreshClaims
    if (decoded.typ !== 'refresh' || !decoded.sub || !decoded.jti || !decoded.fam) {
      throw new Error('Malformed refresh token')
    }
    return decoded
  } catch {
    throw AppError.unauthorized('Invalid or expired refresh token')
  }
}
