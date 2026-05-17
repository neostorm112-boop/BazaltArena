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
  /**
   * Idempotent grant. Relies on the compound unique (userId, achievementId, sprintId)
   * with empty-string sprintId for non-sprint-bound achievements. `skipDuplicates`
   * makes concurrent grants race-safe — at most one row will be inserted.
   */
  async function grant(userId: string, slug: string, sprintId = ''): Promise<void> {
    const achievement = await prisma.achievement.findUnique({ where: { slug } })
    if (!achievement) return
    await prisma.userAchievement.createMany({
      data: [{ userId, achievementId: achievement.id, sprintId }],
      skipDuplicates: true,
    })
  }

  /**
   * Reassign sprint_winner for `sprintId` to `newWinnerUserId`. Runs in one tx:
   *   1. delete any prior winner rows for this sprint that belong to anybody else;
   *   2. insert the new row (skipDuplicates makes the re-grant a no-op).
   * This fixes the "winner sticks" bug — the old #1 loses the badge as soon as a
   * higher-scoring solution surfaces in the same sprint.
   */
  async function reassignSprintWinner(sprintId: string, newWinnerUserId: string): Promise<void> {
    const achievement = await prisma.achievement.findUnique({
      where: { slug: 'sprint_winner' },
    })
    if (!achievement) return
    await prisma.$transaction(async (tx) => {
      await tx.userAchievement.deleteMany({
        where: {
          achievementId: achievement.id,
          sprintId,
          NOT: { userId: newWinnerUserId },
        },
      })
      await tx.userAchievement.createMany({
        data: [{ userId: newWinnerUserId, achievementId: achievement.id, sprintId }],
        skipDuplicates: true,
      })
    })
  }

  return {
    async onSubmissionUpsert({ userId, isCreate }) {
      if (!isCreate) return
      // Drop the previous `count === 1` gate: two concurrent first-ever submissions
      // could both pass `count === 1` (or both miss it). Just attempt the grant —
      // the unique constraint + skipDuplicates makes it a no-op for repeat calls.
      await grant(userId, 'first_submission')
    },

    async onSubmissionStatusChange({ userId, sprintId, submissionId, status, mentorScore }) {
      if (status !== 'ACCEPTED') return
      // Same idea: skip the fragile count==1 check. createMany skipDuplicates is idempotent.
      await grant(userId, 'first_accepted')
      if (mentorScore >= 100) await grant(userId, 'score_100')

      const top = await prisma.submission.findFirst({
        where: { sprintId, status: 'ACCEPTED' },
        orderBy: [{ mentorScore: 'desc' }, { likesCount: 'desc' }, { createdAt: 'asc' }],
        select: { id: true, userId: true },
      })
      if (top && top.id === submissionId) {
        await reassignSprintWinner(sprintId, top.userId)
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
