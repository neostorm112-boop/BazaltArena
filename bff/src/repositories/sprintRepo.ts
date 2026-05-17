import { Prisma, type PrismaClient, type Sprint } from '@prisma/client'

export type SortBy = 'efficiency' | 'likes' | 'mentor'

export interface SprintRepository {
  list(): Promise<Sprint[]>
  findById(id: string): Promise<Sprint | null>
  findBySlug(slug: string): Promise<Sprint | null>
  findActive(): Promise<Sprint | null>
  countSubmissions(sprintId: string): Promise<number>
}

/**
 * Serializable transaction with retry on PG serialization failures (40001) and on
 * the partial-unique-index violation that protects "single active sprint".
 *
 * Why: Sprint.active is guarded by a partial unique index (WHERE active = true).
 * Two concurrent activations can collide on the index even if each tx deactivates
 * others first — Postgres will raise either a serialization failure (under
 * SERIALIZABLE) or a unique violation. Retrying is safe because the operation is
 * idempotent w.r.t. the desired end state.
 */
async function runSerializableWithRetry<T>(
  prisma: PrismaClient,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  retries = 3
): Promise<T> {
  let lastErr: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      })
    } catch (err: unknown) {
      lastErr = err
      const code = err instanceof Prisma.PrismaClientKnownRequestError ? err.code : undefined
      const pgCode =
        err && typeof err === 'object' && 'code' in err
          ? String((err as { code: unknown }).code)
          : undefined
      // P2034 = transaction conflict, P2002 = unique constraint, 40001 = serialization failure
      const retryable = code === 'P2034' || code === 'P2002' || pgCode === '40001'
      if (!retryable || attempt === retries) throw err
    }
  }
  throw lastErr
}

/**
 * Single active sprint: deactivate everything currently active, then create the new row.
 * Runs SERIALIZABLE + retry to coexist with the partial unique index on (active) WHERE active=true.
 */
export async function createSprintWithExclusiveActive(
  prisma: PrismaClient,
  data: Prisma.SprintCreateInput
): Promise<Sprint> {
  if (data.active !== true) {
    return prisma.sprint.create({ data })
  }
  return runSerializableWithRetry(prisma, async (tx) => {
    await tx.sprint.updateMany({ where: { active: true }, data: { active: false } })
    return tx.sprint.create({ data })
  })
}

/**
 * Single active sprint: if patch sets `active: true`, first flip everything currently
 * active to false, then activate the target. SERIALIZABLE + retry — see helper above.
 */
export async function updateSprintWithExclusiveActive(
  prisma: PrismaClient,
  id: string,
  data: Prisma.SprintUpdateInput
): Promise<Sprint> {
  if (data.active !== true) {
    return prisma.sprint.update({ where: { id }, data })
  }
  return runSerializableWithRetry(prisma, async (tx) => {
    await tx.sprint.updateMany({
      where: { active: true, NOT: { id } },
      data: { active: false },
    })
    return tx.sprint.update({ where: { id }, data: { ...data, active: true } })
  })
}

/**
 * Atomically flip the active sprint to `id` (deactivate all other actives first).
 * Used by admin "set active" action. Same serializable + retry semantics.
 */
export async function setActiveSprintExclusively(
  prisma: PrismaClient,
  id: string,
  extra: Prisma.SprintUpdateInput
): Promise<Sprint> {
  return runSerializableWithRetry(prisma, async (tx) => {
    await tx.sprint.updateMany({
      where: { active: true, NOT: { id } },
      data: { active: false },
    })
    return tx.sprint.update({
      where: { id },
      data: { ...extra, active: true },
    })
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
