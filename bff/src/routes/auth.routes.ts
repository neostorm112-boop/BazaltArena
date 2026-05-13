import { Router } from 'express'
import { respondCreated, respondSuccess } from '../api/http/respond.js'
import type { Container } from '../container.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { loginLimiter, refreshLimiter, registerLimiter } from '../middleware/rateLimit.js'
import { authLoginBody, authRefreshBody, authRegisterBody } from '../validation/schemas.js'

export function authRouter(container: Container) {
  const router = Router()

  router.post(
    '/login',
    loginLimiter,
    asyncHandler(async (req, res) => {
      const { email, password } = authLoginBody.parse(req.body)
      const result = await container.auth.login({ loginOrEmail: email, password })
      return respondSuccess(res, result)
    })
  )

  router.post(
    '/register',
    registerLimiter,
    asyncHandler(async (req, res) => {
      const data = authRegisterBody.parse(req.body)
      const devKey = req.headers['x-dev-register-key']
      const result = await container.auth.register({
        ...data,
        devKey: typeof devKey === 'string' ? devKey : undefined,
      })
      return respondCreated(res, result)
    })
  )

  router.post(
    '/refresh',
    refreshLimiter,
    asyncHandler(async (req, res) => {
      const { refreshToken } = authRefreshBody.parse(req.body)
      const result = await container.auth.refresh({ refreshToken })
      return respondSuccess(res, result)
    })
  )

  router.post(
    '/logout',
    requireAuth,
    asyncHandler(async (req, res) => {
      await container.auth.logout(req.auth!.jti)
      await container.memberAudit.log(req.auth!.sub, 'AUTH_LOGOUT', {})
      return respondSuccess(res, { ok: true })
    })
  )

  return router
}
