import { Router } from 'express'
import { respondSuccess } from '../api/http/respond.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { CacheKeys, cached } from '../infra/cache.js'
import type { Container } from '../container.js'

// TTL 60 секунд — для меты этого достаточно. При админских изменениях
// кэш можно инвалидировать через invalidate(CacheKeys.metaPattern()).
const META_CACHE_TTL_SEC = 60

export function metaRouter(container: Container) {
  const router = Router()

  router.get(
    '/',
    asyncHandler(async (_req, res) => {
      const payload = await cached(CacheKeys.meta(), META_CACHE_TTL_SEC, () =>
        container.meta.getMeta()
      )
      res.setHeader('X-Cache-TTL', String(META_CACHE_TTL_SEC))
      return respondSuccess(res, payload)
    })
  )

  return router
}
