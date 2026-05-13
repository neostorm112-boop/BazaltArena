import type { Achievement, PrismaClient } from '@prisma/client'

export interface AchievementWithEarned extends Achievement {
  earned: boolean
}

export interface AchievementRepository {
  listForUser(userId: string): Promise<AchievementWithEarned[]>
}

export function createAchievementRepository(prisma: PrismaClient): AchievementRepository {
  return {
    listForUser: async (userId) => {
      const [all, earned] = await Promise.all([
        prisma.achievement.findMany({ orderBy: { slug: 'asc' } }),
        prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
      ])
      const earnedIds = new Set(earned.map((e) => e.achievementId))
      return all.map((a) => ({ ...a, earned: earnedIds.has(a.id) }))
    },
  }
}
