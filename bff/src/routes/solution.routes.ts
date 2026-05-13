import { Router } from 'express'
import { respondSuccess } from '../api/http/respond.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { likeLimiter } from '../middleware/rateLimit.js'
import type { Container } from '../container.js'
import { solutionIdParams } from '../validation/schemas.js'

export function solutionRouter(container: Container) {
  const router = Router()

  router.put(
    '/:id/like',
    requireAuth,
    likeLimiter,
    asyncHandler(async (req, res) => {
      const { id } = solutionIdParams.parse(req.params)
      const result = await container.likes.like(req.auth!.sub, id)
      return respondSuccess(res, result)
    })
  )

  router.delete(
    '/:id/like',
    requireAuth,
    likeLimiter,
    asyncHandler(async (req, res) => {
      const { id } = solutionIdParams.parse(req.params)
      const result = await container.likes.unlike(req.auth!.sub, id)
      return respondSuccess(res, result)
    })
  )

  return router
}
