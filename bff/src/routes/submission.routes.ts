import { Router } from 'express'
import { respondCreated } from '../api/http/respond.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { idempotencyMiddleware } from '../middleware/idempotency.js'
import { submissionLimiter } from '../middleware/rateLimit.js'
import type { Container } from '../container.js'
import { submissionUpsertBody } from '../validation/schemas.js'

export function submissionRouter(container: Container) {
  const router = Router()

  router.post(
    '/',
    requireAuth,
    submissionLimiter,
    // Idempotency-Key защищает от двойной отправки решения при ретрае на плохой сети.
    idempotencyMiddleware,
    asyncHandler(async (req, res) => {
      const data = submissionUpsertBody.parse(req.body)
      const submission = await container.submissions.submitToActive({
        userId: req.auth!.sub,
        repoUrl: data.repoUrl,
        demoUrl: data.demoUrl,
      })
      await container.admin.recordMemberSubmission(
        req.auth!.sub,
        {
          sprintId: submission.sprintId,
          submissionId: submission.id,
          repoUrl: submission.repoUrl,
          demoUrl: submission.demoUrl,
        },
        submission.isCreate ? 'create' : 'update'
      )
      return respondCreated(res, {
        ok: true,
        id: submission.id,
        receivedAt: submission.createdAt,
        repoUrl: submission.repoUrl,
        demoUrl: submission.demoUrl,
      })
    })
  )

  return router
}
