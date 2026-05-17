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

/**
 * «Доля успешных» в карточке — отношение проверенных решений (REVIEWED+ACCEPTED)
 * к общему числу отправок. Подпись виджета говорит «X проверенных решений», поэтому
 * числитель должен соответствовать ему: 1 из 4 проверенных = 25,0%, а не 0%.
 */
export function computeSuccessRate(verified: number, total: number): string {
  if (total <= 0) return '—'
  const safeVerified = Math.max(0, Math.min(verified, total))
  return formatPct((safeVerified / total) * 100)
}

export function createSprintMetricsService(prisma: PrismaClient) {
  return {
    async recalculate(sprintId: string): Promise<void> {
      const [total, verified, existing] = await Promise.all([
        prisma.submission.count({ where: { sprintId } }),
        prisma.submission.count({
          where: {
            sprintId,
            OR: [{ status: 'ACCEPTED' }, { status: 'REVIEWED' }],
          },
        }),
        prisma.sprint.findUnique({ where: { id: sprintId }, select: { metrics: true } }),
      ])
      const likesSum = await prisma.submission.aggregate({
        where: { sprintId },
        _sum: { likesCount: true },
      })
      const totalLikes = likesSum._sum.likesCount ?? 0

      const successRate = computeSuccessRate(verified, total)
      const submissionsBarPct =
        total === 0 ? 0 : Math.min(100, Math.round((total / Math.max(total, 50)) * 100))
      const computed: SprintMetricsJson = {
        submissions: total,
        submissionsBarPct,
        deltaLabel: totalLikes > 0 ? `${totalLikes} лайков` : 'Метрики обновлены',
        successRate,
        verifiedSolutions: verified,
      }
      // Сохраняем кастомные поля (например `prizeRub`), которые задаются админкой/сидом.
      const existingObj =
        existing?.metrics &&
        typeof existing.metrics === 'object' &&
        !Array.isArray(existing.metrics)
          ? (existing.metrics as Record<string, unknown>)
          : {}
      const merged: Record<string, unknown> = { ...existingObj, ...computed }
      await prisma.sprint.update({
        where: { id: sprintId },
        data: { metrics: merged as object },
      })
    },
  }
}
