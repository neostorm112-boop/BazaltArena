import { Router } from 'express'
import { respondCreated, respondSuccess } from '../api/http/respond.js'
import { AppError } from '../errors/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { submissionLimiter } from '../middleware/rateLimit.js'
import type { Container } from '../container.js'
import { listSortQuery, sprintIdParams, submissionUpsertBody } from '../validation/schemas.js'

export function sprintRouter(container: Container) {
  const router = Router()

  router.get(
    '/',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { sortBy } = listSortQuery.parse(req.query)
      const result = await container.hall.sprintList(req.auth?.sub, sortBy)
      return respondSuccess(res, result)
    })
  )

  router.get(
    '/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id } = sprintIdParams.parse(req.params)
      const { sortBy } = listSortQuery.parse(req.query)
      const result = await container.hall.sprintById(req.auth?.sub, id, sortBy)
      if (!result) throw AppError.notFound('Sprint not found')
      return respondSuccess(res, result)
    })
  )

  router.get(
    '/:id/solutions',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id } = sprintIdParams.parse(req.params)
      const { sortBy } = listSortQuery.parse(req.query)
      const result = await container.hall.sprintById(req.auth?.sub, id, sortBy)
      if (!result) throw AppError.notFound('Sprint not found')
      return respondSuccess(res, {
        solutions: (result as { sprint: { solutions: unknown } }).sprint.solutions,
      })
    })
  )

  router.post(
    '/:id/submissions',
    requireAuth,
    submissionLimiter,
    asyncHandler(async (req, res) => {
      const { id } = sprintIdParams.parse(req.params)
      const data = submissionUpsertBody.parse(req.body)
      const submission = await container.submissions.submit({
        userId: req.auth!.sub,
        sprintId: id,
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
