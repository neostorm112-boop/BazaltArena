import { Router } from 'express'
import { respondSuccess } from '../api/http/respond.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { Container } from '../container.js'

export function metaRouter(container: Container) {
  const router = Router()

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const payload = await container.meta.getMeta()
      return respondSuccess(res, payload)
    })
  )

  return router
}
