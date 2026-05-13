import type { PrismaClient, SubmissionStatus } from '@prisma/client'

const STATUS_RU: Record<SubmissionStatus, string> = {
  PENDING: 'Ожидает проверки',
  REVIEWED: 'Проверено',
  ACCEPTED: 'В зале славы',
  REJECTED: 'Отклонено',
}

export function createMemberNotificationService(prisma: PrismaClient) {
  return {
    async notifySubmissionFieldsChanged(input: {
      userId: string
      submissionId: string
      sprintTitle: string
      before: {
        status: SubmissionStatus
        mentorScore: number
        repoUrl: string
        demoUrl: string | null
        mentorComment: string | null
      }
      after: {
        status: SubmissionStatus
        mentorScore: number
        repoUrl: string
        demoUrl: string | null
        mentorComment: string | null
      }
      /** Поля из PATCH админки: нужны, если в БД значения не изменились (напр. PENDING→PENDING при «На доработку»). */
      mentorPatch?: {
        status?: SubmissionStatus
        mentorScore?: number
        repoUrl?: string
        demoUrl?: string | null
        mentorComment?: string | null
      }
    }) {
      const lines: string[] = []
      if (input.before.status !== input.after.status) {
        lines.push(`Статус: ${STATUS_RU[input.before.status]} → ${STATUS_RU[input.after.status]}`)
      }
      if (input.before.mentorScore !== input.after.mentorScore) {
        lines.push(`Баллы ментора: ${input.before.mentorScore} → ${input.after.mentorScore}`)
      }
      if (input.before.repoUrl !== input.after.repoUrl) {
        lines.push('Обновлена ссылка на репозиторий (см. историю в профиле).')
      }
      const d0 = input.before.demoUrl ?? ''
      const d1 = input.after.demoUrl ?? ''
      if (d0 !== d1) {
        lines.push(d1 ? 'Обновлена ссылка на демо.' : 'Ссылка на демо снята.')
      }

      const c0 = input.before.mentorComment?.trim() ?? ''
      const c1 = input.after.mentorComment?.trim() ?? ''
      if (c0 !== c1) {
        if (c1) {
          lines.push('Наставник оставил комментарий к решению (см. историю в профиле).')
        } else {
          lines.push('Комментарий наставника удалён.')
        }
      }

      const p = input.mentorPatch
      const mentorTouched =
        p &&
        (p.status !== undefined ||
          p.mentorScore !== undefined ||
          p.repoUrl !== undefined ||
          p.demoUrl !== undefined ||
          p.mentorComment !== undefined)

      if (lines.length === 0 && mentorTouched) {
        if (p!.status === 'PENDING') {
          lines.push(
            'Наставник отправил решение на доработку (ожидает повторной проверки). Проверьте репозиторий и критерии брифа.'
          )
        } else if (p!.status === 'REJECTED') {
          lines.push('Решение отклонено наставником.')
        } else if (p!.status === 'ACCEPTED') {
          lines.push('Решение принято в зал славы (или статус подтверждён).')
        } else if (p!.status === 'REVIEWED') {
          lines.push('Решение отмечено как проверенное.')
        } else {
          lines.push('Наставник обновил данные вашей отправки.')
        }
      }

      if (lines.length === 0) return

      const title = `Решение по спринту «${input.sprintTitle}»`
      const body = lines.join('\n')
      await prisma.notification.create({
        data: {
          userId: input.userId,
          kind: 'SUBMISSION_REVIEW',
          title,
          body,
          submissionId: input.submissionId,
        },
      })
    },

    /** После «Принять в зал» в админке — одно уведомление на отправку. */
    async notifyBatchAcceptedToHall(submissionIds: string[]) {
      if (submissionIds.length === 0) return
      const rows = await prisma.submission.findMany({
        where: { id: { in: submissionIds } },
        include: { sprint: { select: { title: true } } },
      })
      for (const row of rows) {
        await prisma.notification.create({
          data: {
            userId: row.userId,
            kind: 'SUBMISSION_REVIEW',
            title: `Решение по спринту «${row.sprint.title}»`,
            body: 'Работа принята в зал славы (статус «В зале славы», 100 баллов ментора).',
            submissionId: row.id,
          },
        })
      }
    },

    countUnread(userId: string) {
      return prisma.notification.count({ where: { userId, readAt: null } })
    },

    listForMe(userId: string) {
      return prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: { id: true, title: true, body: true, createdAt: true, readAt: true },
      })
    },

    markAllRead(userId: string) {
      return prisma.notification.updateMany({
        where: { userId, readAt: null },
        data: { readAt: new Date() },
      })
    },
  }
}

export type MemberNotificationService = ReturnType<typeof createMemberNotificationService>
