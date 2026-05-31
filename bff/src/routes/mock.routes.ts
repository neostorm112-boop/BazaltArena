import { Router, type NextFunction, type Request, type Response } from 'express'
import { z } from 'zod'
import type { PrismaClient, Sprint, Submission } from '@prisma/client'
import { AppError } from '../errors/AppError.js'
import { requireAuth, verifyAccessToken } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { isSessionActive } from '../services/sessionStore.js'
import { loginLimiter, registerLimiter, submissionLimiter } from '../middleware/rateLimit.js'
import type { Container } from '../container.js'
import {
  authRegisterBody,
  cuidParam,
  meProfilePatchBody,
  sprintIdParams,
  submissionUpsertBody,
} from '../validation/schemas.js'

/**
 * Терпимый разбор query для hall-эндпоинтов: оригинальный фронт шлёт `limit`/`offset`
 * (пагинация мок-сервера), которые мы игнорируем, и опционально `sortBy`. Неизвестные
 * ключи не роняют запрос (в отличие от строгой listSortQuery нашего публичного API).
 */
const mockListQuery = z
  .object({
    sortBy: z.enum(['efficiency', 'likes', 'mentor']).optional(),
  })
  .passthrough()
  .transform((q) => ({ sortBy: q.sortBy ?? ('efficiency' as const) }))

/**
 * Маршруты, совместимые с контрактом фронта из конкурса
 * (https://github.com/UsmanGamidov/Basalt-Arena), который ожидает мок-бэкенд на
 * NestJS с префиксом `/api/mock/v1`. Слой-адаптер переводит наши сервисы в shape,
 * который читает оригинальный `client/src/api/basaltApi.js` (см. normalizeMeFromV2).
 *
 * Маппинг статусов: наш `SubmissionStatus` (PENDING/REVIEWED/ACCEPTED/REJECTED) →
 * словарь оригинала (pending_review/approved/deleted_by_user/deleted_by_admin).
 *
 * Монтируется во всех окружениях (см. app.ts), отключается через MOCK_API_ENABLED=false —
 * это слой совместимости с внешним конкурсным фронтом, переиспользующий те же сервисы и guard'ы.
 */

type OriginalStatus = 'pending_review' | 'approved' | 'deleted_by_user' | 'deleted_by_admin'

const USER_STATUS_LABEL: Record<OriginalStatus, string> = {
  pending_review: 'На проверке',
  approved: 'Принято',
  deleted_by_user: 'Отозвано вами',
  deleted_by_admin: 'Удалено админом',
}

function mapStatus(status: string): OriginalStatus {
  switch (status) {
    case 'ACCEPTED':
      return 'approved'
    case 'REJECTED':
      return 'deleted_by_admin'
    case 'PENDING':
    case 'REVIEWED':
    default:
      return 'pending_review'
  }
}

function mapSubmissionForUser(sub: Submission, sprint: Pick<Sprint, 'title' | 'tabLabel'> | null) {
  const status = mapStatus(sub.status)
  return {
    id: sub.id,
    sprintId: sub.sprintId,
    sprintTitle: sprint?.title ?? '',
    tabLabel: sprint?.tabLabel ?? '',
    repoUrl: sub.repoUrl,
    demoUrl: sub.demoUrl ?? null,
    status,
    statusLabel: USER_STATUS_LABEL[status],
    isDeleted: status === 'deleted_by_user' || status === 'deleted_by_admin',
    mentorScore: status === 'approved' ? sub.mentorScore : null,
    reviewNote: sub.mentorComment ?? null,
    submittedAt: sub.createdAt.toISOString(),
    reviewedAt: sub.status === 'PENDING' ? null : sub.updatedAt.toISOString(),
    canDelete: status === 'pending_review',
  }
}

function lowerRole(role: string): string {
  return role.toLowerCase()
}

/**
 * Наш hall-сервис отдаёт спринт с полем `arenaActive` и без `systemActive`/`isMainActive`,
 * а оригинальный фронт читает именно `systemActive` (открыт ли приём) и `isMainActive`
 * (закрепить активный спринт первым). Достраиваем их из `arenaActive`/`endsAt`.
 */
function withMockSprintFlags<T extends { arenaActive?: boolean; endsAt?: string | null }>(
  sprint: T
): T & { systemActive: boolean; isMainActive: boolean } {
  const ends = sprint.endsAt ? Date.parse(sprint.endsAt) : Number.NaN
  const systemActive = Number.isNaN(ends) ? true : ends > Date.now()
  return { ...sprint, systemActive, isMainActive: sprint.arenaActive ?? false }
}

const mockLoginBody = z
  .object({
    loginOrEmail: z.string().trim().min(1).max(320).optional(),
    email: z.string().trim().min(1).max(320).optional(),
    login: z.string().trim().min(1).max(320).optional(),
    password: z.string().min(1).max(512),
    remember: z.boolean().optional(),
  })
  .passthrough()

const solutionLikeParams = z.object({ id: cuidParam, solutionId: cuidParam }).strict()

const deleteSubmissionParams = z.object({ submissionId: cuidParam }).strict()

export function mockRouter(container: Container, prisma: PrismaClient) {
  const router = Router()

  /** Optional auth: если валидный токен есть — кладём claims в req.auth, иначе продолжаем как гость. */
  async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
    try {
      const header = req.headers.authorization
      if (!header?.startsWith('Bearer ')) return next()
      const claims = verifyAccessToken(header.slice(7))
      if (await isSessionActive(claims.jti)) req.auth = claims
    } catch {
      /* гость */
    }
    next()
  }

  // --- auth ---
  router.post(
    '/auth/login',
    loginLimiter,
    asyncHandler(async (req, res) => {
      const body = mockLoginBody.parse(req.body)
      const loginOrEmail = body.loginOrEmail ?? body.email ?? body.login
      if (!loginOrEmail) throw AppError.unauthorized('Укажите логин или email')
      const result = await container.auth.login({ loginOrEmail, password: body.password })
      res.status(200).json({
        accessToken: result.accessToken,
        user: {
          id: result.user.id,
          handle: result.user.handle,
          role: lowerRole(result.user.role),
          avatarUrl: result.user.avatarUrl,
        },
      })
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
      res.status(201).json({
        accessToken: result.accessToken,
        user: {
          id: result.user.id,
          handle: result.user.handle,
          role: lowerRole(result.user.role),
          avatarUrl: result.user.avatarUrl,
        },
      })
    })
  )

  router.post(
    '/auth/logout',
    asyncHandler(async (req, res) => {
      const header = req.headers.authorization
      if (header?.startsWith('Bearer ')) {
        try {
          const claims = verifyAccessToken(header.slice(7))
          await container.auth.logout(claims.jti)
          await container.memberAudit.log(claims.sub, 'AUTH_LOGOUT', {})
        } catch {
          /* best-effort logout */
        }
      }
      res.status(200).json({ ok: true })
    })
  )

  // --- v2 ---
  const v2 = Router()

  v2.get(
    '/meta',
    asyncHandler(async (_req, res) => {
      res.status(200).json(await container.meta.getMeta())
    })
  )

  v2.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.auth!.sub
      const me = await container.userView.me(userId)
      if (!me) throw AppError.unauthorized('User no longer exists')

      // sprintsCompleted / moneyEarned достаём из карточек, чтобы не считать заново.
      const sprintsCard = me.stats.cards.find((c) => c.key === 'sprints')
      const moneyCard = me.stats.cards.find((c) => c.key === 'money')

      // Контекст активного спринта: подтягиваем спринт + enrollment + текущее решение.
      let sprintContext: Record<string, unknown> = {
        activeSprint: null,
        enrolled: false,
        activeSubmission: null,
        title: '',
        tabLabel: '',
        description: '',
        completedLabel: '',
        brief: {},
        systemActive: false,
        endsAt: null,
      }
      if (me.activeSprint) {
        const sprintId = me.activeSprint.id
        const [sprint, access, sub] = await Promise.all([
          prisma.sprint.findUnique({ where: { id: sprintId } }),
          prisma.sprintAccess.findUnique({
            where: { sprint_access_user_sprint_unique: { userId, sprintId } },
          }),
          prisma.submission.findUnique({
            where: { submission_user_sprint_unique: { userId, sprintId } },
          }),
        ])
        const status = sub ? mapStatus(sub.status) : null
        sprintContext = {
          activeSprint: sprintId,
          enrolled: access?.canSubmit ?? false,
          title: me.activeSprint.title,
          tabLabel: sprint?.tabLabel ?? '',
          description: '',
          completedLabel: sprint?.completedLabel ?? '',
          brief: sprint?.brief ?? {},
          systemActive: me.activeSprint.systemActive,
          endsAt: me.activeSprint.endsAt,
          activeSubmission:
            sub && status
              ? {
                  id: sub.id,
                  status,
                  statusLabel: USER_STATUS_LABEL[status],
                  mentorScore: status === 'approved' ? sub.mentorScore : null,
                }
              : null,
        }
      }

      res.status(200).json({
        user: {
          id: me.user.id,
          handle: me.user.handle,
          // Сырая роль (user/admin) — внешний фронт ветвит UI по ней; локализованную метку не отдаём.
          role: lowerRole(req.auth!.role),
          avatarUrl: me.user.avatarUrl,
          profile: {
            bio: me.profile.bio,
            skillsLabel: me.profile.skillsLabel,
            contacts: me.profile.contacts,
            form: me.profile.form,
          },
          stats: {
            points: me.stats.points,
            globalRank: `#${me.stats.position}`,
            leaderboardPosition: me.stats.position,
            leaderboardSize: me.stats.leaderboardSize,
            sprintsCompleted: Number(sprintsCard?.value ?? 0),
            moneyEarned: String(moneyCard?.value ?? '0 ₽'),
            cards: me.stats.cards,
          },
          achievements: me.profile.achievements,
          sprintContext,
          sprintHistory: {
            items: me.sprintHistory.items.map((h) => {
              const status = mapStatus(h.status)
              return {
                id: h.id,
                sprintId: h.sprintId,
                sprintTitle: h.sprintTitle,
                tabLabel: '',
                repoUrl: h.repoUrl,
                demoUrl: h.demoUrl ?? null,
                status,
                statusLabel: USER_STATUS_LABEL[status],
                isDeleted: status === 'deleted_by_user' || status === 'deleted_by_admin',
                mentorScore: status === 'approved' ? h.mentorScore : null,
                reviewNote: h.mentorComment ?? null,
                submittedAt: h.createdAt,
                reviewedAt: null,
                canDelete: status === 'pending_review',
              }
            }),
          },
          notifications: {
            unreadCount: me.notificationsUnread,
            items: me.notifications.map((n) => ({
              id: n.id,
              title: n.title,
              body: n.body,
              read: !n.unread,
              createdAt: n.createdAt,
            })),
          },
        },
      })
    })
  )

  v2.get(
    '/me/sprints',
    requireAuth,
    asyncHandler(async (req, res) => {
      const userId = req.auth!.sub
      const accesses = await prisma.sprintAccess.findMany({
        where: { userId, canSubmit: true },
        include: { sprint: true },
        orderBy: { createdAt: 'desc' },
      })
      const now = Date.now()
      const sprints = await Promise.all(
        accesses.map(async (a) => {
          const sub = await prisma.submission.findUnique({
            where: { submission_user_sprint_unique: { userId, sprintId: a.sprintId } },
          })
          const s = a.sprint
          const systemActive = s.published && (!s.endsAt || s.endsAt.getTime() > now)
          const status = sub ? mapStatus(sub.status) : null
          return {
            id: s.id,
            tabLabel: s.tabLabel,
            title: s.title,
            description: '',
            published: s.published,
            enrolledAt: a.createdAt.toISOString(),
            endsAt: s.endsAt ? s.endsAt.toISOString() : null,
            systemActive,
            activeSubmission:
              sub && status
                ? {
                    id: sub.id,
                    status,
                    statusLabel: USER_STATUS_LABEL[status],
                    canSubmit: systemActive,
                  }
                : null,
          }
        })
      )
      res.status(200).json({ sprints })
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
      const skillsLabel =
        updated.stack && updated.stack.length > 0 ? updated.stack.join(', ') : updated.skillsLabel
      res.status(200).json({
        ok: true,
        profile: {
          bio: updated.bio,
          skillsLabel,
          contacts: {
            telegram: updated.telegram,
            email: updated.email,
            github: updated.githubUrl,
          },
          form: {
            username: updated.handle,
            email: updated.email,
            telegram: updated.telegram,
            about: updated.bio,
          },
        },
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
    optionalAuth,
    asyncHandler(async (req, res) => {
      const { sortBy } = mockListQuery.parse(req.query)
      const payload = (await container.hall.hall(req.auth?.sub, sortBy)) as {
        sprints: Array<{ arenaActive?: boolean; endsAt?: string | null }>
      }
      const sprints = payload.sprints.map(withMockSprintFlags)
      res.status(200).json({
        ...payload,
        sprints,
        pagination: {
          total: sprints.length,
          limit: sprints.length,
          offset: 0,
          hasMore: false,
        },
      })
    })
  )

  v2.get(
    '/sprints/:id',
    optionalAuth,
    asyncHandler(async (req, res) => {
      const { id } = sprintIdParams.parse(req.params)
      const { sortBy } = mockListQuery.parse(req.query)
      const result = (await container.hall.sprintById(req.auth?.sub, id, sortBy)) as {
        sprint: { arenaActive?: boolean; endsAt?: string | null }
      } | null
      if (!result) throw AppError.notFound('Sprint not found')
      res.status(200).json({ ...result, sprint: withMockSprintFlags(result.sprint) })
    })
  )

  v2.get(
    '/sprints/:id/solutions',
    optionalAuth,
    asyncHandler(async (req, res) => {
      const { id } = sprintIdParams.parse(req.params)
      const { sortBy } = mockListQuery.parse(req.query)
      const result = (await container.hall.sprintById(req.auth?.sub, id, sortBy)) as {
        sprint: { solutions: unknown[] }
      } | null
      if (!result) throw AppError.notFound('Sprint not found')
      // Контракт оригинала: голый массив решений.
      res.status(200).json(result.sprint.solutions)
    })
  )

  v2.get(
    '/sprints/:id/submissions/active',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id } = sprintIdParams.parse(req.params)
      const sub = await prisma.submission.findUnique({
        where: { submission_user_sprint_unique: { userId: req.auth!.sub, sprintId: id } },
        include: { sprint: { select: { title: true, tabLabel: true } } },
      })
      if (!sub) {
        res.status(200).json({ submission: null })
        return
      }
      res.status(200).json({ submission: mapSubmissionForUser(sub, sub.sprint) })
    })
  )

  async function respondSubmission(res: Response, submissionId: string) {
    const row = await prisma.submission.findUniqueOrThrow({
      where: { id: submissionId },
      select: { status: true },
    })
    const status = mapStatus(row.status)
    res.status(201).json({ id: submissionId, status, statusLabel: USER_STATUS_LABEL[status] })
  }

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
      await respondSubmission(res, submission.id)
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
      await respondSubmission(res, submission.id)
    })
  )

  v2.delete(
    '/submissions/:submissionId',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { submissionId } = deleteSubmissionParams.parse(req.params)
      const sub = await prisma.submission.findUnique({
        where: { id: submissionId },
        include: { sprint: { select: { title: true, tabLabel: true } } },
      })
      if (!sub || sub.userId !== req.auth!.sub) throw AppError.notFound('Submission not found')
      if (sub.status !== 'PENDING') {
        throw AppError.conflict('Решение нельзя отозвать на текущем статусе')
      }
      await prisma.submission.delete({ where: { id: submissionId } })
      const mapped = mapSubmissionForUser(sub, sub.sprint)
      res.status(200).json({
        submission: {
          ...mapped,
          status: 'deleted_by_user',
          statusLabel: USER_STATUS_LABEL.deleted_by_user,
          isDeleted: true,
          canDelete: false,
        },
      })
    })
  )

  v2.post(
    '/sprints/:id/solutions/:solutionId/like',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { id, solutionId } = solutionLikeParams.parse(req.params)
      const userId = req.auth!.sub
      // Решение должно принадлежать указанному спринту (как в оригинале) — иначе 404.
      const submission = await prisma.submission.findUnique({
        where: { id: solutionId },
        select: { sprintId: true },
      })
      if (!submission || submission.sprintId !== id) throw AppError.notFound('Solution not found')
      const existing = await prisma.solutionLike.findUnique({
        where: { solution_like_unique: { userId, submissionId: solutionId } },
      })
      const result = existing
        ? await container.likes.unlike(userId, solutionId)
        : await container.likes.like(userId, solutionId)
      res.status(200).json({ likes: result.likes, liked: result.liked })
    })
  )

  router.use('/v2', v2)
  return router
}
