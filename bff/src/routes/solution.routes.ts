import { Router, type RequestHandler } from 'express'
import { respondSuccess } from '../api/http/respond.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { likeLimiter } from '../middleware/rateLimit.js'
import type { Container } from '../container.js'
import { solutionIdParams } from '../validation/schemas.js'

export function solutionRouter(container: Container) {
  const router = Router()

  const likeHandler: RequestHandler = asyncHandler(async (req, res) => {
    const { id } = solutionIdParams.parse(req.params)
    const result = await container.likes.like(req.auth!.sub, id)
    return respondSuccess(res, result)
  })

  const unlikeHandler: RequestHandler = asyncHandler(async (req, res) => {
    const { id } = solutionIdParams.parse(req.params)
    const result = await container.likes.unlike(req.auth!.sub, id)
    return respondSuccess(res, result)
  })

  // Deprecated: PUT alias kept for one release for legacy clients.
  // New clients must use POST /:id/like. Remove after clients migrate.
  const deprecatedPutAlias: RequestHandler = (req, res, next) => {
    res.setHeader('Deprecation', 'true')
    res.setHeader('Sunset', 'PUT /:id/like — use POST instead')
    return likeHandler(req, res, next)
  }

  router.post('/:id/like', requireAuth, likeLimiter, likeHandler)
  router.delete('/:id/like', requireAuth, likeLimiter, unlikeHandler)
  router.put('/:id/like', requireAuth, likeLimiter, deprecatedPutAlias)

  return router
}
