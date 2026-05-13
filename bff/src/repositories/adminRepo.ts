import { Prisma, type PrismaClient, type UserRole } from '@prisma/client'
import { AppError } from '../errors/AppError.js'
import { normalizeDatesForBecomeActive } from '../domain/sprintArenaSchedule.js'
import { createSprintWithExclusiveActive, updateSprintWithExclusiveActive } from './sprintRepo.js'

const adminUserListSelect = {
  id: true,
  email: true,
  handle: true,
  role: true,
  points: true,
  createdAt: true,
  avatarUrl: true,
  bio: true,
  telegram: true,
  githubUrl: true,
  realName: true,
  stack: true,
  moneyEarned: true,
} as const

export type AdminUserListRow = {
  id: string
  email: string
  handle: string
  role: UserRole
  points: number
  createdAt: Date
  avatarUrl: string
  bio: string
  telegram: string
  github: string
  realName: string
  stack: string[]
  moneyEarned: number
}

function toAdminUserListRow(u: {
  id: string
  email: string
  handle: string
  role: UserRole
  points: number
  createdAt: Date
  avatarUrl: string
  bio: string
  telegram: string
  githubUrl: string
  realName: string
  stack: string[]
  moneyEarned: number
}): AdminUserListRow {
  const { githubUrl, ...rest } = u
  return { ...rest, github: githubUrl }
}

export type AdminUserPatchInput = {
  role?: UserRole
  email?: string
  points?: number
  handle?: string
  bio?: string
  telegram?: string
  githubUrl?: string
  realName?: string
  stack?: string[]
  moneyEarned?: number
}

export function createAdminRepository(prisma: PrismaClient) {
  return {
    async listUsers(input: { search?: string; skip: number; take: number }) {
      const where: Prisma.UserWhereInput = {}
      if (input.search?.trim()) {
        const q = input.search.trim()
        where.OR = [
          { email: { contains: q, mode: 'insensitive' } },
          { handle: { contains: q, mode: 'insensitive' } },
        ]
      }
      const [rows, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: input.skip,
          take: input.take,
          orderBy: { createdAt: 'desc' },
          select: adminUserListSelect,
        }),
        prisma.user.count({ where }),
      ])
      const items = rows.map(toAdminUserListRow)
      return { items, total }
    },

    async getUserAdminSnapshot(id: string) {
      const row = await prisma.user.findUnique({
        where: { id },
        select: adminUserListSelect,
      })
      return row ? toAdminUserListRow(row) : null
    },

    async patchUser(id: string, data: AdminUserPatchInput) {
      const update: Prisma.UserUpdateInput = {}
      if (data.role !== undefined) update.role = data.role
      if (data.email !== undefined) update.email = data.email
      if (data.points !== undefined) update.points = data.points
      if (data.handle !== undefined) update.handle = data.handle
      if (data.bio !== undefined) update.bio = data.bio
      if (data.telegram !== undefined) update.telegram = data.telegram
      if (data.githubUrl !== undefined) update.githubUrl = data.githubUrl
      if (data.realName !== undefined) update.realName = data.realName
      if (data.stack !== undefined) {
        update.stack = data.stack
        update.skillsLabel = data.stack.length > 0 ? data.stack.join(', ') : ''
      }
      if (data.moneyEarned !== undefined) update.moneyEarned = data.moneyEarned

      if (Object.keys(update).length === 0) {
        const current = await prisma.user.findUnique({
          where: { id },
          select: adminUserListSelect,
        })
        return current ? toAdminUserListRow(current) : null
      }

      try {
        await prisma.user.update({ where: { id }, data: update })
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          throw AppError.conflict('Handle или email уже занят')
        }
        throw e
      }
      const row = await prisma.user.findUnique({
        where: { id },
        select: adminUserListSelect,
      })
      return row ? toAdminUserListRow(row) : null
    },

    async listSprints() {
      return prisma.sprint.findMany({ orderBy: { createdAt: 'desc' } })
    },

    async findSprintById(id: string) {
      return prisma.sprint.findUnique({ where: { id } })
    },

    async createSprint(data: Prisma.SprintCreateInput) {
      return createSprintWithExclusiveActive(prisma, data)
    },

    async duplicateSprint(sourceId: string) {
      const src = await prisma.sprint.findUnique({ where: { id: sourceId } })
      if (!src) return null
      const base = `${src.slug}-copy`
      let slug = base
      let n = 2
      for (;;) {
        const clash = await prisma.sprint.findUnique({ where: { slug }, select: { id: true } })
        if (!clash) break
        slug = `${base}-${n}`
        n += 1
      }
      return createSprintWithExclusiveActive(prisma, {
        slug,
        title: `${src.title} (копия)`,
        tabLabel: src.tabLabel,
        tabIcon: src.tabIcon,
        completedLabel: src.completedLabel,
        tags: [...src.tags],
        active: false,
        published: true,
        archived: false,
        startsAt: src.startsAt,
        endsAt: src.endsAt,
        brief: src.brief as Prisma.InputJsonValue,
        metrics: src.metrics as Prisma.InputJsonValue,
      })
    },

    async patchSprint(id: string, data: Prisma.SprintUpdateInput) {
      return updateSprintWithExclusiveActive(prisma, id, data)
    },

    async setActiveSprint(id: string) {
      const sprint = await prisma.sprint.findUnique({ where: { id } })
      if (!sprint) return null
      const { startsAt, endsAt } = normalizeDatesForBecomeActive({
        existingEndsAt: sprint.endsAt,
      })
      await prisma.$transaction([
        prisma.sprint.updateMany({ where: { id: { not: id } }, data: { active: false } }),
        prisma.sprint.update({
          where: { id },
          data: { active: true, archived: false, startsAt, endsAt },
        }),
      ])
      return prisma.sprint.findUnique({ where: { id } })
    },

    async listSprintAccess(sprintId: string) {
      return prisma.sprintAccess.findMany({
        where: { sprintId },
        include: { user: { select: { id: true, email: true, handle: true, role: true } } },
      })
    },

    async upsertSprintAccess(input: {
      userId: string
      sprintId: string
      canSubmit: boolean
      canView: boolean
    }) {
      return prisma.sprintAccess.upsert({
        where: {
          sprint_access_user_sprint_unique: { userId: input.userId, sprintId: input.sprintId },
        },
        create: input,
        update: { canSubmit: input.canSubmit, canView: input.canView },
      })
    },

    async deleteSprintAccess(userId: string, sprintId: string) {
      await prisma.sprintAccess.deleteMany({ where: { userId, sprintId } })
    },

    async listSubmissions(input: {
      sprintId?: string
      userId?: string
      statusIn?: Array<'PENDING' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED'>
      skip: number
      take: number
    }) {
      const where: Prisma.SubmissionWhereInput = {}
      if (input.sprintId) where.sprintId = input.sprintId
      if (input.userId) where.userId = input.userId
      if (input.statusIn?.length) where.status = { in: input.statusIn }
      const [items, total] = await Promise.all([
        prisma.submission.findMany({
          where,
          skip: input.skip,
          take: input.take,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, handle: true, email: true } },
            sprint: { select: { id: true, title: true } },
          },
        }),
        prisma.submission.count({ where }),
      ])
      return { items, total }
    },

    async patchSubmission(
      id: string,
      data: {
        mentorScore?: number
        status?: 'PENDING' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED'
        repoUrl?: string
        demoUrl?: string | null
        mentorComment?: string | null
      }
    ) {
      return prisma.$transaction(async (tx) => {
        const before = await tx.submission.findUnique({
          where: { id },
          include: { sprint: { select: { title: true } } },
        })
        if (!before) return null
        const row = await tx.submission.update({
          where: { id },
          data,
          include: { sprint: { select: { title: true } } },
        })
        return { before, row }
      })
    },

    async listAchievements() {
      return prisma.achievement.findMany({ orderBy: { slug: 'asc' } })
    },

    async upsertAchievement(input: {
      id?: string
      slug: string
      title: string
      subtitle: string
      icon: string
    }) {
      if (input.id) {
        return prisma.achievement.update({
          where: { id: input.id },
          data: {
            slug: input.slug,
            title: input.title,
            subtitle: input.subtitle,
            icon: input.icon,
          },
        })
      }
      return prisma.achievement.create({
        data: {
          slug: input.slug,
          title: input.title,
          subtitle: input.subtitle,
          icon: input.icon,
        },
      })
    },

    async deleteAchievement(id: string) {
      await prisma.userAchievement.deleteMany({ where: { achievementId: id } })
      await prisma.achievement.delete({ where: { id } })
    },

    async grantAchievement(userId: string, achievementId: string) {
      return prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId } },
        create: { userId, achievementId },
        update: {},
      })
    },

    async revokeAchievement(userId: string, achievementId: string) {
      await prisma.userAchievement.deleteMany({ where: { userId, achievementId } })
    },

    async getDashboardStats() {
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30)
      thirtyDaysAgo.setUTCHours(0, 0, 0, 0)

      const [membersCount, pendingReviewCount, recentSubs] = await Promise.all([
        prisma.user.count({ where: { role: 'USER' } }),
        prisma.submission.count({ where: { status: 'PENDING' } }),
        prisma.submission.findMany({
          where: { createdAt: { gte: thirtyDaysAgo } },
          select: { createdAt: true },
        }),
      ])

      const byDay: Record<string, number> = {}
      for (const s of recentSubs) {
        const k = s.createdAt.toISOString().slice(0, 10)
        byDay[k] = (byDay[k] ?? 0) + 1
      }

      const activityByDay: Array<{ date: string; count: number }> = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date()
        d.setUTCDate(d.getUTCDate() - i)
        d.setUTCHours(0, 0, 0, 0)
        const key = d.toISOString().slice(0, 10)
        activityByDay.push({ date: key, count: byDay[key] ?? 0 })
      }

      return { membersCount, pendingReviewCount, activityByDay }
    },

    async batchUpsertSprintAccess(input: {
      sprintId: string
      userIds: string[]
      canSubmit: boolean
      canView: boolean
    }) {
      await prisma.$transaction(
        input.userIds.map((userId) =>
          prisma.sprintAccess.upsert({
            where: {
              sprint_access_user_sprint_unique: { userId, sprintId: input.sprintId },
            },
            create: {
              userId,
              sprintId: input.sprintId,
              canSubmit: input.canSubmit,
              canView: input.canView,
            },
            update: { canSubmit: input.canSubmit, canView: input.canView },
          })
        )
      )
      return { ok: true as const, count: input.userIds.length }
    },

    async batchAcceptSubmissions(ids: string[]) {
      const targets = await prisma.submission.findMany({
        where: { id: { in: ids } },
        select: { id: true, sprintId: true },
      })
      if (targets.length === 0) {
        return { ok: true as const, updated: 0, sprintIds: [] as string[] }
      }
      await prisma.submission.updateMany({
        where: { id: { in: targets.map((t) => t.id) } },
        data: { status: 'ACCEPTED', mentorScore: 100 },
      })
      return {
        ok: true as const,
        updated: targets.length,
        sprintIds: [...new Set(targets.map((t) => t.sprintId))],
      }
    },

    async grantAchievementToSprintParticipants(sprintId: string, achievementId: string) {
      await prisma.achievement.findUniqueOrThrow({ where: { id: achievementId } })
      const subs = await prisma.submission.findMany({
        where: { sprintId },
        distinct: ['userId'],
        select: { userId: true },
      })
      const access = await prisma.sprintAccess.findMany({
        where: { sprintId },
        select: { userId: true },
      })
      const userIds = [...new Set([...subs.map((s) => s.userId), ...access.map((a) => a.userId)])]
      if (userIds.length === 0) {
        return { ok: true as const, granted: 0 }
      }
      await prisma.userAchievement.createMany({
        data: userIds.map((userId) => ({ userId, achievementId })),
        skipDuplicates: true,
      })
      return { ok: true as const, granted: userIds.length }
    },

    async appendAuditLog(params: { actorId: string; action: string; details: Prisma.JsonObject }) {
      return prisma.auditLog.create({
        data: {
          actorId: params.actorId,
          action: params.action,
          details: params.details,
        },
      })
    },

    async listAuditLogs(input: { skip: number; take: number; subjectUserId?: string }) {
      const where: Prisma.AuditLogWhereInput = {}
      if (input.subjectUserId) {
        const uid = input.subjectUserId
        where.OR = [
          { actorId: uid },
          { details: { path: ['targetUserId'], equals: uid } },
          { details: { path: ['userId'], equals: uid } },
        ]
      }
      const [items, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          skip: input.skip,
          take: input.take,
          orderBy: { createdAt: 'desc' },
          include: {
            actor: { select: { id: true, handle: true, email: true, role: true } },
          },
        }),
        prisma.auditLog.count({ where }),
      ])
      return { items, total }
    },

    async listUserAchievements(userId: string) {
      return prisma.userAchievement.findMany({
        where: { userId },
        orderBy: { earnedAt: 'desc' },
        include: {
          achievement: {
            select: { id: true, slug: true, title: true, subtitle: true, icon: true },
          },
        },
      })
    },

    /** Спринты, где у пользователя есть отправка и/или явная запись SprintAccess. */
    async listUserSprintActivity(userId: string) {
      const sprintSelect = {
        id: true,
        slug: true,
        title: true,
        tabLabel: true,
        active: true,
        published: true,
        archived: true,
        startsAt: true,
        endsAt: true,
      } as const

      const [submissions, accesses] = await Promise.all([
        prisma.submission.findMany({
          where: { userId },
          orderBy: { updatedAt: 'desc' },
          include: { sprint: { select: sprintSelect } },
        }),
        prisma.sprintAccess.findMany({
          where: { userId },
          include: { sprint: { select: sprintSelect } },
        }),
      ])

      type SprintMini = (typeof submissions)[number]['sprint']
      type Row = {
        sprint: SprintMini
        submission: null | {
          id: string
          repoUrl: string
          demoUrl: string | null
          mentorScore: number
          status: string
          likesCount: number
          createdAt: Date
          updatedAt: Date
        }
        access: null | { canSubmit: boolean; canView: boolean }
      }

      const map = new Map<string, Row>()

      for (const sub of submissions) {
        const sid = sub.sprintId
        const submission = {
          id: sub.id,
          repoUrl: sub.repoUrl,
          demoUrl: sub.demoUrl,
          mentorScore: sub.mentorScore,
          status: sub.status,
          likesCount: sub.likesCount,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
        }
        const existing = map.get(sid)
        if (existing) {
          existing.submission = submission
          existing.sprint = sub.sprint
        } else {
          map.set(sid, { sprint: sub.sprint, submission, access: null })
        }
      }

      for (const acc of accesses) {
        const sid = acc.sprintId
        const access = { canSubmit: acc.canSubmit, canView: acc.canView }
        const existing = map.get(sid)
        if (existing) {
          existing.access = access
          existing.sprint = acc.sprint
        } else {
          map.set(sid, { sprint: acc.sprint, submission: null, access })
        }
      }

      const items = [...map.values()].sort((a, b) => {
        if (a.sprint.active !== b.sprint.active) return a.sprint.active ? -1 : 1
        const ta = a.submission?.updatedAt ?? a.sprint.endsAt ?? a.sprint.startsAt
        const tb = b.submission?.updatedAt ?? b.sprint.endsAt ?? b.sprint.startsAt
        const aTime = ta ? new Date(ta).getTime() : 0
        const bTime = tb ? new Date(tb).getTime() : 0
        return bTime - aTime
      })

      return { items }
    },
  }
}

export type AdminRepository = ReturnType<typeof createAdminRepository>
