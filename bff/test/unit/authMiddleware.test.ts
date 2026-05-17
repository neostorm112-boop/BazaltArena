import jwt from 'jsonwebtoken'
import { describe, expect, it } from 'vitest'
import { env } from '../../src/config/env.js'
import { AppError } from '../../src/errors/AppError.js'
import { verifyAccessToken } from '../../src/middleware/auth.js'

function sign(payload: Record<string, unknown>): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: 60 })
}

describe('verifyAccessToken — strict typ check', () => {
  it('accepts a token with typ="access"', () => {
    const token = sign({ sub: 'u_1', jti: 'j_1', role: 'USER', typ: 'access' })
    const claims = verifyAccessToken(token)
    expect(claims.sub).toBe('u_1')
    expect(claims.jti).toBe('j_1')
  })

  it('rejects a refresh token presented as access (typ="refresh")', () => {
    const token = sign({ sub: 'u_1', jti: 'j_1', role: 'USER', typ: 'refresh' })
    expect(() => verifyAccessToken(token)).toThrow(AppError)
  })

  it('rejects a token without typ field (no «soft» bypass)', () => {
    const token = sign({ sub: 'u_1', jti: 'j_1', role: 'USER' })
    expect(() => verifyAccessToken(token)).toThrow(AppError)
  })

  it('rejects a token with unknown typ', () => {
    const token = sign({ sub: 'u_1', jti: 'j_1', role: 'USER', typ: 'totally-not-access' })
    expect(() => verifyAccessToken(token)).toThrow(AppError)
  })
})
