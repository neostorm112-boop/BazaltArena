import type { Request } from 'express'
import { Router } from 'express'
import { respondCreated, respondSuccess } from '../api/http/respond.js'
import { AppError } from '../errors/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { requireAdminArea } from '../middleware/adminAccess.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import type { AdminService } from '../services/adminService.js'
import {
  adminAchievementIdParams,
  adminAuditLogsQuery,
  adminBatchSprintAccessBody,
  adminBatchSubmissionIdsBody,
  adminCreateSprintBody,
  adminPatchSprintBody,
  adminPatchSubmissionBody,
  adminPatchUserBody,
  adminPutSprintAccessBody,
  adminSubmissionIdParams,
  adminSprintAccessParams,
  adminSprintAccessUserParams,
  adminSprintAchievementGrantParams,
  adminSprintIdParams,
  adminSubmissionsQuery,
  adminUpsertAchievementBody,
  adminUserAchievementParams,
  adminUserAchievementsCollectionParams,
  adminUserIdParams,
  adminUserSprintsCollectionParams,
  adminUsersQuery,
} from '../validation/schemas.js'

function actorId(req: Request): string {
  if (!req.auth?.sub) throw AppError.unauthorized('Missing authentication')
  return req.auth.sub
}

export function adminRouter(admin: AdminService) {
  const router = Router()
  router.use(requireAuth, requireAdminArea)

  router.get(
    '/metrics',
    asyncHandler(async (_req, res) => {
      return respondSuccess(res, await admin.getDashboardStats())
    })
  )

  router.get(
    '/audit-logs',
    asyncHandler(async (req, res) => {
      const q = adminAuditLogsQuery.parse(req.query)
      const result = await admin.listAuditLogs({
        skip: q.skip,
        take: q.take,
        subjectUserId: q.userId,
      })
      return respondSuccess(res, result)
    })
  )

  router.get(
    '/users',
    asyncHandler(async (req, res) => {
      const q = adminUsersQuery.parse(req.query)
      const result = await admin.listUsers({ search: q.search, skip: q.skip, take: q.take })
      return respondSuccess(res, result)
    })
  )

  router.get(
    '/users/:userId/achievements',
    asyncHandler(async (req, res) => {
      const { userId } = adminUserAchievementsCollectionParams.parse(req.params)
      const items = await admin.listUserAchievements(userId)
      return respondSuccess(res, { items })
    })
  )

  router.get(
    '/users/:userId/sprints',
    asyncHandler(async (req, res) => {
      const { userId } = adminUserSprintsCollectionParams.parse(req.params)
      const result = await admin.listUserSprintActivity(userId)
      return respondSuccess(res, result)
    })
  )

  router.patch(
    '/users/:id',
    asyncHandler(async (req, res) => {
      const { id } = adminUserIdParams.parse(req.params)
      const body = adminPatchUserBody.parse(req.body)
      const updated = await admin.patchUser(actorId(req), id, body)
      return respondSuccess(res, { user: updated })
    })
  )

  router.get(
    '/sprints',
    asyncHandler(async (_req, res) => {
      return respondSuccess(res, { sprints: await admin.listSprints() })
    })
  )

  router.post(
    '/sprints',
    asyncHandler(async (req, res) => {
      const body = adminCreateSprintBody.parse(req.body)
      const sprint = await admin.createSprint(actorId(req), {
        slug: body.slug,
        title: body.title,
        tabLabel: body.tabLabel,
        tabIcon: body.tabIcon === undefined ? undefined : body.tabIcon,
        completedLabel: body.completedLabel,
        tags: body.tags,
        active: body.active ?? false,
        published: body.published ?? true,
        archived: body.archived ?? false,
        brief: body.brief as never,
        metrics: body.metrics as never,
        startsAt:
          body.startsAt === undefined
            ? undefined
            : body.startsAt === null
              ? null
              : new Date(body.startsAt),
        endsAt:
          body.endsAt === undefined
            ? undefined
            : body.endsAt === null
              ? null
              : new Date(body.endsAt),
      })
      return respondCreated(res, { sprint })
    })
  )

  router.post(
    '/sprints/:id/duplicate',
    asyncHandler(async (req, res) => {
      const { id } = adminSprintIdParams.parse(req.params)
      const sprint = await admin.duplicateSprint(actorId(req), id)
      return respondCreated(res, { sprint })
    })
  )

  router.patch(
    '/sprints/:id',
    asyncHandler(async (req, res) => {
      const { id } = adminSprintIdParams.parse(req.params)
      const body = adminPatchSprintBody.parse(req.body)
      const data: Record<string, unknown> = { ...body }
      if (body.startsAt !== undefined) {
        data.startsAt = body.startsAt === null ? null : new Date(body.startsAt)
      }
      if (body.endsAt !== undefined) {
        data.endsAt = body.endsAt === null ? null : new Date(body.endsAt)
      }
      const sprint = await admin.patchSprint(actorId(req), id, data as never)
      return respondSuccess(res, { sprint })
    })
  )

  router.post(
    '/sprints/:id/activate',
    asyncHandler(async (req, res) => {
      const { id } = adminSprintIdParams.parse(req.params)
      const sprint = await admin.setActiveSprint(actorId(req), id)
      return respondSuccess(res, { sprint })
    })
  )

  router.get(
    '/sprints/:id/access',
    asyncHandler(async (req, res) => {
      const { id } = adminSprintIdParams.parse(req.params)
      const rows = await admin.listSprintAccess(id)
      return respondSuccess(res, { access: rows })
    })
  )

  router.put(
    '/sprints/:sprintId/access',
    asyncHandler(async (req, res) => {
      const { sprintId } = adminSprintAccessParams.parse(req.params)
      const body = adminPutSprintAccessBody.parse(req.body)
      const row = await admin.upsertSprintAccess(actorId(req), {
        userId: body.userId,
        sprintId,
        canSubmit: body.canSubmit,
        canView: body.canView,
      })
      return respondSuccess(res, { access: row })
    })
  )

  router.put(
    '/sprints/:sprintId/access/batch',
    asyncHandler(async (req, res) => {
      const { sprintId } = adminSprintAccessParams.parse(req.params)
      const body = adminBatchSprintAccessBody.parse(req.body)
      const result = await admin.batchUpsertSprintAccess(actorId(req), {
        sprintId,
        userIds: body.userIds,
        canSubmit: body.canSubmit,
        canView: body.canView,
      })
      return respondSuccess(res, result)
    })
  )

  router.delete(
    '/sprints/:sprintId/access/:userId',
    asyncHandler(async (req, res) => {
      const p = adminSprintAccessUserParams.parse(req.params)
      await admin.deleteSprintAccess(actorId(req), p.userId, p.sprintId)
      return respondSuccess(res, { ok: true })
    })
  )

  router.get(
    '/submissions',
    asyncHandler(async (req, res) => {
      const q = adminSubmissionsQuery.parse(req.query)
      const result = await admin.listSubmissions({
        sprintId: q.sprintId,
        userId: q.userId,
        statusIn: q.status,
        skip: q.skip,
        take: q.take,
      })
      return respondSuccess(res, result)
    })
  )

  router.patch(
    '/submissions/:id',
    asyncHandler(async (req, res) => {
      const { id } = adminSubmissionIdParams.parse(req.params)
      const body = adminPatchSubmissionBody.parse(req.body)
      const row = await admin.patchSubmission(actorId(req), id, body)
      return respondSuccess(res, { submission: row })
    })
  )

  router.post(
    '/submissions/batch-accept',
    asyncHandler(async (req, res) => {
      const body = adminBatchSubmissionIdsBody.parse(req.body)
      const result = await admin.batchAcceptSubmissions(actorId(req), body.ids)
      return respondSuccess(res, result)
    })
  )

  router.get(
    '/achievements',
    asyncHandler(async (_req, res) => {
      return respondSuccess(res, { achievements: await admin.listAchievements() })
    })
  )

  router.put(
    '/achievements',
    asyncHandler(async (req, res) => {
      const body = adminUpsertAchievementBody.parse(req.body)
      const row = await admin.upsertAchievement(actorId(req), body)
      return respondSuccess(res, { achievement: row })
    })
  )

  router.delete(
    '/achievements/:id',
    asyncHandler(async (req, res) => {
      const { id } = adminAchievementIdParams.parse(req.params)
      await admin.deleteAchievement(actorId(req), id)
      return respondSuccess(res, { ok: true })
    })
  )

  router.post(
    '/sprints/:sprintId/achievements/:achievementId/grant-sprint',
    asyncHandler(async (req, res) => {
      const p = adminSprintAchievementGrantParams.parse(req.params)
      const result = await admin.grantAchievementToSprintParticipants(
        actorId(req),
        p.sprintId,
        p.achievementId
      )
      return respondSuccess(res, result)
    })
  )

  router.post(
    '/users/:userId/achievements/:achievementId',
    asyncHandler(async (req, res) => {
      const p = adminUserAchievementParams.parse(req.params)
      await admin.grantAchievement(actorId(req), p.userId, p.achievementId)
      return respondCreated(res, { ok: true })
    })
  )

  router.delete(
    '/users/:userId/achievements/:achievementId',
    asyncHandler(async (req, res) => {
      const p = adminUserAchievementParams.parse(req.params)
      await admin.revokeAchievement(actorId(req), p.userId, p.achievementId)
      return respondSuccess(res, { ok: true })
    })
  )

  return router
}
