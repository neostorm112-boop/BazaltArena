import type { Prisma, PrismaClient, Sprint } from '@prisma/client'

export type SortBy = 'efficiency' | 'likes' | 'mentor'

export interface SprintRepository {
  list(): Promise<Sprint[]>
  findById(id: string): Promise<Sprint | null>
  findBySlug(slug: string): Promise<Sprint | null>
  findActive(): Promise<Sprint | null>
  countSubmissions(sprintId: string): Promise<number>
}

/** Single active sprint: deactivate all, then create (when `data.active` is true). */
export async function createSprintWithExclusiveActive(
  prisma: PrismaClient,
  data: Prisma.SprintCreateInput
): Promise<Sprint> {
  if (data.active !== true) {
    return prisma.sprint.create({ data })
  }
  return prisma.$transaction(async (tx) => {
    await tx.sprint.updateMany({ data: { active: false } })
    return tx.sprint.create({ data })
  })
}

/** Single active sprint: if patch sets `active: true`, deactivate all others first. */
export async function updateSprintWithExclusiveActive(
  prisma: PrismaClient,
  id: string,
  data: Prisma.SprintUpdateInput
): Promise<Sprint> {
  if (data.active !== true) {
    return prisma.sprint.update({ where: { id }, data })
  }
  return prisma.$transaction(async (tx) => {
    await tx.sprint.updateMany({ data: { active: false } })
    return tx.sprint.update({ where: { id }, data: { ...data, active: true } })
  })
}

export function createSprintRepository(prisma: PrismaClient): SprintRepository {
  return {
    list: () =>
      prisma.sprint.findMany({
        where: { archived: false, published: true },
        orderBy: { createdAt: 'desc' },
      }),
    findById: (id) => prisma.sprint.findUnique({ where: { id } }),
    findBySlug: (slug) => prisma.sprint.findUnique({ where: { slug } }),
    findActive: () =>
      prisma.sprint.findFirst({
        where: { active: true, archived: false, published: true },
      }),
    countSubmissions: (sprintId) => prisma.submission.count({ where: { sprintId } }),
  }
}

export function sortOrderForSubmissions(
  sortBy: SortBy
): Prisma.SubmissionOrderByWithRelationInput[] {
  switch (sortBy) {
    case 'likes':
      return [{ likesCount: 'desc' }, { mentorScore: 'desc' }, { createdAt: 'asc' }]
    case 'mentor':
      /** Оценка наставника; при равном балле — раньше отправивший выше. */
      return [{ mentorScore: 'desc' }, { createdAt: 'asc' }, { likesCount: 'desc' }]
    default:
      /** Эффективность: балл + социальное подтверждение лайками. */
      return [{ mentorScore: 'desc' }, { likesCount: 'desc' }, { createdAt: 'asc' }]
  }
}
