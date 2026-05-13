import { Router } from 'express'
import { respondSuccess } from '../api/http/respond.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { Container } from '../container.js'
import { listSortQuery } from '../validation/schemas.js'

export function hallRouter(container: Container) {
  const router = Router()

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { sortBy } = listSortQuery.parse(req.query)
      const payload = await container.hall.hall(req.auth?.sub, sortBy)
      return respondSuccess(res, payload)
    })
  )

  return router
}
