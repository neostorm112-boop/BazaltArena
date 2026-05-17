import type { Prisma } from '@prisma/client'
import { normalizeDatesForBecomeActive } from '../domain/sprintArenaSchedule.js'
import { AppError } from '../errors/AppError.js'
import { safeAudit as runSafeAudit } from '../infra/safeAudit.js'
import type { AdminRepository, AdminUserListRow } from '../repositories/adminRepo.js'
import type { AdminPatchUserBody } from '../validation/schemas.js'

export type SprintMetricsWriter = { recalculate: (sprintId: string) => Promise<void> }

export type AdminDataChangeDetail = { entity: 'sprint' | 'submission' | 'user' }

function normalizeGithubInput(raw: string): string {
  const t = raw.trim()
  if (!t) return ''
  if (/^https?:\/\//i.test(t)) return t
  if (t.startsWith('/')) return t
  return `/${t.replace(/^\/+/, '')}`
}

function profileAuditShape(row: AdminUserListRow) {
  return {
    bio: row.bio,
    telegram: row.telegram,
    github: row.github,
    realName: row.realName,
    stack: row.stack,
    moneyEarned: row.moneyEarned,
  }
}

function accountAuditShape(row: AdminUserListRow) {
  return {
    role: row.role,
    email: row.email,
    points: row.points,
    handle: row.handle,
  }
}

function diffAudit(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  keys: readonly string[]
): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {}
  for (const k of keys) {
    const bv = before[k]
    const av = after[k]
    if (k === 'stack' && Array.isArray(bv) && Array.isArray(av)) {
      if (JSON.stringify(bv) !== JSON.stringify(av)) out[k] = { from: bv, to: av }
      continue
    }
    if (bv !== av) out[k] = { from: bv, to: av }
  }
  return out
}

const PROFILE_AUDIT_KEYS = [
  'bio',
  'telegram',
  'github',
  'realName',
  'stack',
  'moneyEarned',
] as const
const ACCOUNT_AUDIT_KEYS = ['role', 'email', 'points', 'handle'] as const

async function safeAudit(
  db: AdminRepository,
  actorId: string,
  action: string,
  details: Record<string, unknown>
) {
  await runSafeAudit(
    () =>
      db.appendAuditLog({
        actorId,
        action,
        details: details as Prisma.JsonObject,
      }),
    { actorId, action }
  )
}

import type { MemberNotificationService } from './memberNotificationService.js'

export interface AdminSubmissionStatusHook {
  onSubmissionStatusChange(input: {
    userId: string
    sprintId: string
    submissionId: string
    status: 'PENDING' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED'
    mentorScore: number
  }): Promise<void>
}

export function createAdminService(
  db: AdminRepository,
  metrics: SprintMetricsWriter,
  notifyDataUpdated?: (detail: AdminDataChangeDetail) => void,
  memberNotifications?: Pick<
    MemberNotificationService,
    'notifySubmissionFieldsChanged' | 'notifyBatchAcceptedToHall'
  >,
  submissionStatusHook?: AdminSubmissionStatusHook
) {
  const fire = (entity: AdminDataChangeDetail['entity']) => {
    try {
      notifyDataUpdated?.({ entity })
    } catch {
      /* */
    }
  }

  return {
    listUsers: db.listUsers,

    async patchUser(actorId: string, id: string, body: AdminPatchUserBody) {
      const before = await db.getUserAdminSnapshot(id)
      if (!before) throw AppError.notFound('User not found')

      const patch: Parameters<AdminRepository['patchUser']>[1] = {}
      if (body.role !== undefined) patch.role = body.role
      if (body.email !== undefined) patch.email = body.email.trim().toLowerCase()
      if (body.points !== undefined) patch.points = body.points
      if (body.handle !== undefined) patch.handle = body.handle
      if (body.bio !== undefined) patch.bio = body.bio
      if (body.telegram !== undefined) patch.telegram = body.telegram.trim()
      if (body.github !== undefined) patch.githubUrl = normalizeGithubInput(body.github)
      if (body.realName !== undefined) patch.realName = body.realName.trim()
      if (body.stack !== undefined) patch.stack = body.stack
      if (body.moneyEarned !== undefined) patch.moneyEarned = body.moneyEarned

      const row = await db.patchUser(id, patch)
      if (!row) throw AppError.notFound('User not found')

      const profileChanges = diffAudit(
        profileAuditShape(before) as Record<string, unknown>,
        profileAuditShape(row) as Record<string, unknown>,
        [...PROFILE_AUDIT_KEYS]
      )
      const accountChanges = diffAudit(
        accountAuditShape(before) as Record<string, unknown>,
        accountAuditShape(row) as Record<string, unknown>,
        [...ACCOUNT_AUDIT_KEYS]
      )

      const auditDetails: Record<string, unknown> = { targetUserId: id }
      if (Object.keys(profileChanges).length > 0) {
        auditDetails.changedProfileFields = Object.keys(profileChanges)
        auditDetails.profileChanges = profileChanges
      }
      if (Object.keys(accountChanges).length > 0) {
        auditDetails.changedAccountFields = Object.keys(accountChanges)
        auditDetails.accountChanges = accountChanges
      }

      await safeAudit(db, actorId, 'USER_PATCH', auditDetails as Prisma.JsonObject)
      fire('user')
      return row
    },

    listSprints: db.listSprints,

    async createSprint(actorId: string, data: Prisma.SprintCreateInput) {
      if (data.active === true && data.archived === true) {
        throw AppError.validation('Активный спринт не может быть в архиве')
      }
      let payload: Prisma.SprintCreateInput = data
      if (data.active === true) {
        const existingEnd =
          data.endsAt instanceof Date
            ? data.endsAt
            : data.endsAt != null
              ? new Date(data.endsAt as string | number)
              : null
        const { startsAt, endsAt } = normalizeDatesForBecomeActive({ existingEndsAt: existingEnd })
        payload = { ...data, startsAt, endsAt }
      }
      const row = await db.createSprint(payload)
      await safeAudit(db, actorId, 'SPRINT_CREATE', {
        sprintId: row.id,
        slug: row.slug,
        title: row.title,
        active: row.active,
      })
      fire('sprint')
      return row
    },

    async duplicateSprint(actorId: string, id: string) {
      const row = await db.duplicateSprint(id)
      if (!row) throw AppError.notFound('Sprint not found')
      await safeAudit(db, actorId, 'SPRINT_DUPLICATE', {
        sourceSprintId: id,
        sprintId: row.id,
        slug: row.slug,
        title: row.title,
      })
      fire('sprint')
      return row
    },

    async patchSprint(actorId: string, id: string, data: Prisma.SprintUpdateInput) {
      let payload: Prisma.SprintUpdateInput = { ...data }
      if (data.brief !== undefined) {
        const existing = await db.findSprintById(id)
        if (!existing) throw AppError.notFound('Sprint not found')
        const prev =
          existing.brief != null &&
          typeof existing.brief === 'object' &&
          !Array.isArray(existing.brief)
            ? { ...(existing.brief as Record<string, unknown>) }
            : {}
        const incoming =
          data.brief != null &&
          typeof data.brief === 'object' &&
          !Array.isArray(data.brief as unknown)
            ? { ...(data.brief as Record<string, unknown>) }
            : {}
        payload = { ...payload, brief: { ...prev, ...incoming } as Prisma.InputJsonValue }
      }
      if (payload.archived === true && payload.active === undefined) {
        payload = { ...payload, active: false }
      }
      if (payload.active === true && payload.archived === true) {
        throw AppError.validation('Активный спринт не может быть в архиве')
      }
      if (payload.active === true) {
        const existing = await db.findSprintById(id)
        if (!existing) throw AppError.notFound('Sprint not found')
        let mergedEnd: Date | null = existing.endsAt
        if (data.endsAt !== undefined) {
          mergedEnd =
            data.endsAt === null
              ? null
              : data.endsAt instanceof Date
                ? data.endsAt
                : new Date(data.endsAt as string | number)
        }
        const { startsAt, endsAt } = normalizeDatesForBecomeActive({ existingEndsAt: mergedEnd })
        payload = { ...payload, startsAt, endsAt }
      }
      const row = await db.patchSprint(id, payload)
      await safeAudit(db, actorId, 'SPRINT_PATCH', {
        sprintId: id,
        patch: JSON.parse(JSON.stringify(data)) as Prisma.JsonObject,
      })
      fire('sprint')
      return row
    },

    async setActiveSprint(actorId: string, id: string) {
      const row = await db.setActiveSprint(id)
      await safeAudit(db, actorId, 'SPRINT_ACTIVATE', { sprintId: id })
      fire('sprint')
      return row
    },

    listSprintAccess: db.listSprintAccess,

    async upsertSprintAccess(
      actorId: string,
      input: Parameters<AdminRepository['upsertSprintAccess']>[0]
    ) {
      const row = await db.upsertSprintAccess(input)
      await safeAudit(db, actorId, 'SPRINT_ACCESS_UPSERT', {
        sprintId: input.sprintId,
        userId: input.userId,
        canSubmit: input.canSubmit,
        canView: input.canView,
      })
      fire('sprint')
      return row
    },

    async deleteSprintAccess(actorId: string, userId: string, sprintId: string) {
      await db.deleteSprintAccess(userId, sprintId)
      await safeAudit(db, actorId, 'SPRINT_ACCESS_DELETE', { userId, sprintId })
      fire('sprint')
    },

    listSubmissions: db.listSubmissions,

    getDashboardStats: db.getDashboardStats,

    listAuditLogs: (input: Parameters<AdminRepository['listAuditLogs']>[0]) =>
      db.listAuditLogs(input),

    /** Участник отправил/обновил решение с клиента арены (не админка). */
    async recordMemberSubmission(
      actorId: string,
      input: { sprintId: string; submissionId: string; repoUrl: string; demoUrl?: string | null },
      kind: 'create' | 'update'
    ) {
      const action = kind === 'create' ? 'SUBMISSION_CREATE' : 'SUBMISSION_UPDATE'
      await safeAudit(db, actorId, action, {
        userId: actorId,
        sprintId: input.sprintId,
        submissionId: input.submissionId,
        repoUrl: input.repoUrl,
        demoUrl: input.demoUrl ?? null,
      } as Prisma.JsonObject)
      fire('submission')
    },

    listUserAchievements: (userId: string) => db.listUserAchievements(userId),

    listUserSprintActivity: (userId: string) => db.listUserSprintActivity(userId),

    async batchUpsertSprintAccess(
      actorId: string,
      input: { sprintId: string; userIds: string[]; canSubmit: boolean; canView: boolean }
    ) {
      const r = await db.batchUpsertSprintAccess(input)
      await safeAudit(db, actorId, 'SPRINT_ACCESS_BATCH', {
        sprintId: input.sprintId,
        userCount: input.userIds.length,
        canSubmit: input.canSubmit,
        canView: input.canView,
      })
      fire('sprint')
      return r
    },

    async batchAcceptSubmissions(actorId: string, ids: string[]) {
      const r = await db.batchAcceptSubmissions(ids)
      await Promise.all(r.sprintIds.map((id) => metrics.recalculate(id)))
      await safeAudit(db, actorId, 'SUBMISSION_BATCH_ACCEPT', {
        submissionIds: ids,
        updated: r.updated,
        sprintIds: r.sprintIds,
      })
      fire('submission')
      try {
        await memberNotifications?.notifyBatchAcceptedToHall(ids)
      } catch {
        /* */
      }
      if (submissionStatusHook) {
        for (const t of r.accepted ?? []) {
          try {
            await submissionStatusHook.onSubmissionStatusChange({
              userId: t.userId,
              sprintId: t.sprintId,
              submissionId: t.id,
              status: 'ACCEPTED',
              mentorScore: 100,
            })
          } catch {
            /* */
          }
        }
      }
      fire('user')
      return r
    },

    async grantAchievementToSprintParticipants(
      actorId: string,
      sprintId: string,
      achievementId: string
    ) {
      const r = await db.grantAchievementToSprintParticipants(sprintId, achievementId)
      await safeAudit(db, actorId, 'ACHIEVEMENT_GRANT_SPRINT', {
        sprintId,
        achievementId,
        granted: r.granted,
      })
      fire('user')
      return r
    },

    async patchSubmission(
      actorId: string,
      id: string,
      data: {
        mentorScore?: number
        status?: 'PENDING' | 'REVIEWED' | 'ACCEPTED' | 'REJECTED'
        repoUrl?: string
        demoUrl?: string | null
        mentorComment?: string | null
      }
    ) {
      const result = await db.patchSubmission(id, data)
      if (!result) throw AppError.notFound('Submission not found')
      const { before, row } = result
      await metrics.recalculate(row.sprintId)
      await safeAudit(db, actorId, 'SUBMISSION_PATCH', {
        submissionId: id,
        sprintId: row.sprintId,
        userId: row.userId,
        patch: data,
      })
      fire('submission')
      try {
        await memberNotifications?.notifySubmissionFieldsChanged({
          userId: row.userId,
          submissionId: row.id,
          sprintTitle: row.sprint.title,
          before: {
            status: before.status,
            mentorScore: before.mentorScore,
            repoUrl: before.repoUrl,
            demoUrl: before.demoUrl,
            mentorComment: before.mentorComment ?? null,
          },
          after: {
            status: row.status,
            mentorScore: row.mentorScore,
            repoUrl: row.repoUrl,
            demoUrl: row.demoUrl,
            mentorComment: row.mentorComment ?? null,
          },
          mentorPatch: data,
        })
      } catch {
        /* уведомление не должно ломать PATCH */
      }
      if (submissionStatusHook && data.status !== undefined && data.status !== before.status) {
        try {
          await submissionStatusHook.onSubmissionStatusChange({
            userId: row.userId,
            sprintId: row.sprintId,
            submissionId: row.id,
            status: row.status,
            mentorScore: row.mentorScore,
          })
        } catch {
          /* achievement check must not break PATCH */
        }
      }
      fire('user')
      return row
    },

    listAchievements: db.listAchievements,

    async upsertAchievement(
      actorId: string,
      input: Parameters<AdminRepository['upsertAchievement']>[0]
    ) {
      const row = await db.upsertAchievement(input)
      await safeAudit(db, actorId, 'ACHIEVEMENT_UPSERT', {
        achievementId: row.id,
        slug: row.slug,
        title: row.title,
      })
      fire('user')
      return row
    },

    async deleteAchievement(actorId: string, id: string) {
      await db.deleteAchievement(id)
      await safeAudit(db, actorId, 'ACHIEVEMENT_DELETE', { achievementId: id })
      fire('user')
    },

    async grantAchievement(actorId: string, userId: string, achievementId: string) {
      const row = await db.grantAchievement(userId, achievementId)
      await safeAudit(db, actorId, 'ACHIEVEMENT_GRANT', { userId, achievementId })
      fire('user')
      return row
    },

    async revokeAchievement(actorId: string, userId: string, achievementId: string) {
      await db.revokeAchievement(userId, achievementId)
      await safeAudit(db, actorId, 'ACHIEVEMENT_REVOKE', { userId, achievementId })
      fire('user')
    },
  }
}

export type AdminService = ReturnType<typeof createAdminService>
