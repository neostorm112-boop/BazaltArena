import { Router } from 'express'
import { AppError } from '../errors/AppError.js'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { loginLimiter, registerLimiter, submissionLimiter } from '../middleware/rateLimit.js'
import type { Container } from '../container.js'
import {
  authLoginBody,
  authRegisterBody,
  listSortQuery,
  meProfilePatchBody,
  sprintIdParams,
  submissionUpsertBody,
} from '../validation/schemas.js'

/**
 * Маршруты, совместимые с контрактом фронта из конкурса
 * (https://github.com/UsmanGamidov/Basalt-Arena).
 *
 * Базовый префикс: `/api/mock/v1`. Внутри:
 *   - `/auth/*`   — login/register/logout (v1)
 *   - `/v2/*`     — me / meta / sprints / submissions
 *
 * Формат ошибок наружу — `{ error: string }` (см. middleware/errorHandler.ts).
 */
export function mockRouter(container: Container) {
  const router = Router()

  // --- v1 auth ---
  router.post(
    '/auth/login',
    loginLimiter,
    asyncHandler(async (req, res) => {
      const { email, password } = authLoginBody.parse(req.body)
      const result = await container.auth.login({ loginOrEmail: email, password })
      // Внешний фронт читает только `accessToken`; остальное оставляем для совместимости.
      res.status(200).json(result)
    })
  )

  router.post(
    '/auth/register',
    registerLimiter,
    asyncHandler(async (req, res) => {
      const data = authRegisterBody.parse(req.body)
      const devKey = req.headers['x-dev-register-key']
      const result = await container.auth.register({
        ...data,
        devKey: typeof devKey === 'string' ? devKey : undefined,
      })
      res.status(201).json(result)
    })
  )

  router.post(
    '/auth/logout',
    asyncHandler(async (req, res) => {
      // Делаем logout best-effort: если токен валиден — гасим сессию, если нет — отвечаем 204.
      const header = req.headers.authorization
      if (header?.startsWith('Bearer ')) {
        try {
          const { verifyAccessToken } = await import('../middleware/auth.js')
          const claims = verifyAccessToken(header.slice(7))
          await container.auth.logout(claims.jti)
          await container.memberAudit.log(claims.sub, 'AUTH_LOGOUT', {}).catch(() => undefined)
        } catch {
          /* ignore */
        }
      }
      res.status(204).send()
    })
  )

  // --- v2 ---
  const v2 = Router()

  v2.get(
    '/meta',
    asyncHandler(async (_req, res) => {
      const payload = await container.meta.getMeta()
      res.status(200).json(payload)
    })
  )

  v2.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const me = await container.userView.me(req.auth!.sub)
      if (!me) throw AppError.unauthorized('User no longer exists')

      // Маппинг в shape, который ожидает внешний фронт (см. basaltApi.js: normalizeMeFromV2):
      const payload = {
        user: {
          id: me.user.id,
          handle: me.user.handle,
          role: me.user.role,
          avatarUrl: me.user.avatarUrl,
          profile: {
            bio: me.profile.bio,
            skillsLabel: me.profile.skillsLabel,
            contacts: me.profile.contacts,
            form: me.profile.form,
          },
          stats: {
            globalRank: `#${me.stats.position}`,
            points: me.stats.points,
            cards: me.stats.cards,
          },
          sprintContext: { activeSprint: me.activeSprint },
          notifications: { unreadCount: me.notificationsUnread },
          achievements: me.profile.achievements,
        },
        sprintHistory: me.sprintHistory,
      }
      res.status(200).json(payload)
    })
  )

  v2.patch(
    '/me/profile',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { form } = meProfilePatchBody.parse(req.body)
      const updated = await container.profiles.patch(req.auth!.sub, form)
      await container.memberAudit.log(req.auth!.sub, 'PROFILE_PATCH', {
        fields: Object.keys(form),
      })
      res.status(200).json({
        ok: true,
        user: { id: updated.id, handle: updated.handle, avatarUrl: updated.avatarUrl },
      })
    })
  )

  v2.post(
    '/me/notifications/read',
    requireAuth,
    asyncHandler(async (req, res) => {
      const unreadCount = await container.userView.markAllNotificationsRead(req.auth!.sub)
      res.status(200).json({ unreadCount })
    })
  )

  v2.get(
    '/sprints',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { sortBy } = listSortQuery.parse(req.query)
      // Возвращаем полный hall-payload — внешний фронт читает page/quote/pastWinners/sprints
      // из этого ответа (см. getHall в basaltApi.js).
      const payload = await container.hall.hall(req.auth!.sub, sortBy)
      res.status(200).json(payload)
    })
  )

  v2.get(
    '/sprints/:id',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id } = sprintIdParams.parse(req.params)
      const { sortBy } = listSortQuery.parse(req.query)
      const result = await container.hall.sprintById(req.auth!.sub, id, sortBy)
      if (!result) throw AppError.notFound('Sprint not found')
      res.status(200).json(result)
    })
  )

  v2.get(
    '/sprints/:id/solutions',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id } = sprintIdParams.parse(req.params)
      const { sortBy } = listSortQuery.parse(req.query)
      const result = await container.hall.sprintById(req.auth!.sub, id, sortBy)
      if (!result) throw AppError.notFound('Sprint not found')
      res.status(200).json({
        solutions: (result as { sprint: { solutions: unknown } }).sprint.solutions,
      })
    })
  )

  v2.post(
    '/submissions',
    requireAuth,
    submissionLimiter,
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
      res.status(201).json({
        ok: true,
        id: submission.id,
        receivedAt: submission.createdAt,
        repoUrl: submission.repoUrl,
        demoUrl: submission.demoUrl,
      })
    })
  )

  v2.post(
    '/sprints/:id/submissions',
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
      res.status(201).json({
        ok: true,
        id: submission.id,
        receivedAt: submission.createdAt,
        repoUrl: submission.repoUrl,
        demoUrl: submission.demoUrl,
      })
    })
  )

  router.use('/v2', v2)
  return router
}
