import type { PrismaClient } from '@prisma/client'

export type SprintMetricsJson = {
  submissions: number
  submissionsBarPct: number
  deltaLabel: string
  successRate: string
  verifiedSolutions: number
}

function formatPct(n: number): string {
  return `${n.toFixed(1).replace('.', ',')}%`
}

export function createSprintMetricsService(prisma: PrismaClient) {
  return {
    async recalculate(sprintId: string): Promise<void> {
      const [total, verified] = await Promise.all([
        prisma.submission.count({ where: { sprintId } }),
        prisma.submission.count({
          where: {
            sprintId,
            OR: [{ status: 'ACCEPTED' }, { status: 'REVIEWED' }],
          },
        }),
      ])
      const accepted = await prisma.submission.count({ where: { sprintId, status: 'ACCEPTED' } })
      const likesSum = await prisma.submission.aggregate({
        where: { sprintId },
        _sum: { likesCount: true },
      })
      const totalLikes = likesSum._sum.likesCount ?? 0

      const successRate = total === 0 ? '—' : formatPct((accepted / total) * 100)
      const submissionsBarPct =
        total === 0 ? 0 : Math.min(100, Math.round((total / Math.max(total, 50)) * 100))
      const metrics: SprintMetricsJson = {
        submissions: total,
        submissionsBarPct,
        deltaLabel: totalLikes > 0 ? `${totalLikes} лайков` : 'Метрики обновлены',
        successRate,
        verifiedSolutions: verified,
      }
      await prisma.sprint.update({
        where: { id: sprintId },
        data: { metrics: metrics as object },
      })
    },
  }
}
