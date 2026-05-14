import type { PrismaClient, SubmissionStatus } from '@prisma/client'

export const AUTO_ACHIEVEMENTS = [
  {
    slug: 'first_submission',
    title: 'Первый шаг',
    subtitle: 'Отправил первое решение',
    icon: 'flag',
  },
  {
    slug: 'first_accepted',
    title: 'Принято',
    subtitle: 'Первое решение принято наставником',
    icon: 'verified',
  },
  {
    slug: 'score_100',
    title: 'Сотка',
    subtitle: 'Получил 100 баллов за решение',
    icon: 'military_tech',
  },
  {
    slug: 'sprint_winner',
    title: 'Чемпион спринта',
    subtitle: 'Лучшее решение в спринте',
    icon: 'emoji_events',
  },
  {
    slug: 'popular_solution',
    title: 'Народный любимец',
    subtitle: 'Решение собрало 25+ лайков',
    icon: 'favorite',
  },
] as const

const POPULAR_THRESHOLD = 25

export interface AchievementGranter {
  onSubmissionUpsert(input: {
    userId: string
    sprintId: string
    submissionId: string
    isCreate: boolean
  }): Promise<void>
  onSubmissionStatusChange(input: {
    userId: string
    sprintId: string
    submissionId: string
    status: SubmissionStatus
    mentorScore: number
  }): Promise<void>
  onLikesChanged(input: { submissionId: string; likes: number }): Promise<void>
}

export function createAchievementGranter(prisma: PrismaClient): AchievementGranter {
  async function grant(userId: string, slug: string): Promise<void> {
    const achievement = await prisma.achievement.findUnique({ where: { slug } })
    if (!achievement) return
    await prisma.userAchievement.upsert({
      where: { userId_achievementId: { userId, achievementId: achievement.id } },
      update: {},
      create: { userId, achievementId: achievement.id },
    })
  }

  return {
    async onSubmissionUpsert({ userId, isCreate }) {
      if (!isCreate) return
      const total = await prisma.submission.count({ where: { userId } })
      if (total === 1) await grant(userId, 'first_submission')
    },

    async onSubmissionStatusChange({ userId, sprintId, submissionId, status, mentorScore }) {
      if (status !== 'ACCEPTED') return
      const acceptedCount = await prisma.submission.count({
        where: { userId, status: 'ACCEPTED' },
      })
      if (acceptedCount === 1) await grant(userId, 'first_accepted')
      if (mentorScore >= 100) await grant(userId, 'score_100')

      const top = await prisma.submission.findFirst({
        where: { sprintId, status: 'ACCEPTED' },
        orderBy: [{ mentorScore: 'desc' }, { likesCount: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, userId: true },
      })
      if (top && top.id === submissionId) {
        await grant(top.userId, 'sprint_winner')
      }
    },

    async onLikesChanged({ submissionId, likes }) {
      if (likes < POPULAR_THRESHOLD) return
      const submission = await prisma.submission.findUnique({
        where: { id: submissionId },
        select: { userId: true },
      })
      if (!submission) return
      await grant(submission.userId, 'popular_solution')
    },
  }
}
