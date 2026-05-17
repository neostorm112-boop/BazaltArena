import type { PrismaClient } from '@prisma/client'
import { env } from './config/env.js'
import { createMemberAudit } from './infra/memberAudit.js'
import { createUserRepository } from './repositories/userRepo.js'
import { createSprintRepository } from './repositories/sprintRepo.js'
import { createSubmissionRepository } from './repositories/submissionRepo.js'
import { createLikeRepository } from './repositories/likeRepo.js'
import { createAchievementRepository } from './repositories/achievementRepo.js'
import { createSprintAccessRepository } from './repositories/sprintAccessRepo.js'
import { createAuthService } from './services/authService.js'
import { createLikeService } from './services/likeService.js'
import { createSubmissionService } from './services/submissionService.js'
import { createProfileService } from './services/profileService.js'
import { createHallService } from './services/hallService.js'
import { createUserViewService } from './services/userViewService.js'
import { createSprintMetricsService } from './services/sprintMetricsService.js'
import { createAdminRepository } from './repositories/adminRepo.js'
import { createAdminService, type AdminDataChangeDetail } from './services/adminService.js'
import { createMemberNotificationService } from './services/memberNotificationService.js'
import { createAchievementGranter } from './services/achievementGranter.js'
import { createMetaService } from './services/metaService.js'

export interface Container {
  auth: ReturnType<typeof createAuthService>
  likes: ReturnType<typeof createLikeService>
  submissions: ReturnType<typeof createSubmissionService>
  profiles: ReturnType<typeof createProfileService>
  hall: ReturnType<typeof createHallService>
  userView: ReturnType<typeof createUserViewService>
  admin: ReturnType<typeof createAdminService>
  memberAudit: ReturnType<typeof createMemberAudit>
  achievementGranter: ReturnType<typeof createAchievementGranter>
  meta: ReturnType<typeof createMetaService>
}

/** Тип таргетированного user-события (string union из realtime). */
export type UserNotifierEvent = 'submission:reviewed' | 'achievement:granted' | 'solution:liked'

/** Сигнатура callback, который доставляет событие конкретному пользователю. */
export type UserNotifier = (
  userId: string,
  event: UserNotifierEvent,
  payload: Record<string, unknown>
) => void

export type BuildContainerOptions = {
  notifyDataUpdated?: (detail: AdminDataChangeDetail) => void
  /** Точечная WebSocket-отправка события пользователю (только владельцу решения и т.п.). */
  notifyUser?: UserNotifier
}

export function buildContainer(prisma: PrismaClient, opts?: BuildContainerOptions): Container {
  const memberAudit = createMemberAudit(prisma)
  const users = createUserRepository(prisma)
  const sprints = createSprintRepository(prisma)
  const submissions = createSubmissionRepository(prisma)
  const likes = createLikeRepository(prisma)
  const achievements = createAchievementRepository(prisma)
  const sprintAccess = createSprintAccessRepository(prisma)
  const metrics = createSprintMetricsService(prisma)
  const memberNotifications = createMemberNotificationService(prisma)
  const achievementGranter = createAchievementGranter(prisma)
  const meta = createMetaService({ prisma })
  const notify = opts?.notifyDataUpdated
  const notifyUser = opts?.notifyUser
  const recalc = (sprintId: string) => metrics.recalculate(sprintId).catch(() => undefined)
  const recalcAndNotifyHall = async (sprintId: string) => {
    await recalc(sprintId)
    try {
      notify?.({ entity: 'submission' })
    } catch {
      /* */
    }
    // Инвалидируем мета-кэш (статистика по спринтам тоже могла измениться).
    try {
      const { invalidate, CacheKeys } = await import('./infra/cache.js')
      await invalidate(CacheKeys.metaPattern())
    } catch {
      /* */
    }
  }

  return {
    auth: createAuthService({
      users,
      devRegisterKey: env.DEV_REGISTER_KEY,
      onMemberRegistered: (userId) => sprintAccess.grantNewMemberActiveSprint(userId),
      memberAudit,
    }),
    likes: createLikeService({
      prisma,
      likes,
      submissions,
      sprintAccess,
      onAfterLikeChange: recalcAndNotifyHall,
      memberAudit,
      onAfterLikeMutation: ({ submissionId, likes: likesCount }) =>
        achievementGranter.onLikesChanged({ submissionId, likes: likesCount }),
    }),
    submissions: createSubmissionService({
      sprints,
      submissions,
      sprintAccess,
      onAfterSubmission: recalcAndNotifyHall,
      onAfterSubmissionUpsert: (input) => achievementGranter.onSubmissionUpsert(input),
    }),
    profiles: createProfileService({ users }),
    hall: createHallService({ prisma, sprints, submissions, likes, sprintAccess }),
    userView: createUserViewService({
      prisma,
      users,
      sprints,
      achievements,
      notifications: memberNotifications,
    }),
    admin: createAdminService(
      createAdminRepository(prisma),
      metrics,
      opts?.notifyDataUpdated,
      memberNotifications,
      achievementGranter,
      notifyUser
    ),
    memberAudit,
    achievementGranter,
    meta,
  }
}
