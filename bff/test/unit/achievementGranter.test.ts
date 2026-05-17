import { describe, expect, it, vi } from 'vitest'
import { createAchievementGranter } from '../../src/services/achievementGranter.js'

type Row = { userId: string; achievementId: string; sprintId: string }

/**
 * Minimal Prisma stub that simulates the parts the granter actually touches:
 *   - achievement.findUnique({ where: { slug } })
 *   - userAchievement.createMany({ data, skipDuplicates }) — honors compound unique
 *   - userAchievement.deleteMany({ where })
 *   - submission.findFirst (only for sprint_winner top-lookup)
 *   - $transaction(fn) — runs fn against the same stub (no isolation; good enough for unit tests)
 *
 * The point is to verify the granter's *contract*: idempotent first_submission,
 * winner reassignment that revokes prior winners. Race semantics are covered by the
 * Postgres unique constraint and exercised in integration tests.
 */
function makeFakePrisma(
  initialAchievements: Record<string, { id: string; slug: string }>,
  options: {
    topSubmission?: { id: string; userId: string } | null
  } = {}
) {
  const rows: Row[] = []
  const seen = (r: Row) =>
    rows.some(
      (x) =>
        x.userId === r.userId &&
        x.achievementId === r.achievementId &&
        x.sprintId === r.sprintId
    )

  const prisma = {
    achievement: {
      findUnique: vi.fn(async ({ where: { slug } }: { where: { slug: string } }) => {
        return initialAchievements[slug] ?? null
      }),
    },
    userAchievement: {
      createMany: vi.fn(
        async ({
          data,
          skipDuplicates,
        }: {
          data: Row[]
          skipDuplicates?: boolean
        }) => {
          let inserted = 0
          for (const r of data) {
            if (skipDuplicates && seen(r)) continue
            rows.push(r)
            inserted++
          }
          return { count: inserted }
        }
      ),
      deleteMany: vi.fn(
        async ({
          where,
        }: {
          where: { achievementId: string; sprintId?: string; NOT?: { userId: string } }
        }) => {
          const before = rows.length
          for (let i = rows.length - 1; i >= 0; i--) {
            const r = rows[i]
            if (r.achievementId !== where.achievementId) continue
            if (where.sprintId !== undefined && r.sprintId !== where.sprintId) continue
            if (where.NOT && r.userId === where.NOT.userId) continue
            rows.splice(i, 1)
          }
          return { count: before - rows.length }
        }
      ),
    },
    submission: {
      findFirst: vi.fn(async () => options.topSubmission ?? null),
    },
    $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)),
  }
  return { prisma, rows }
}

describe('achievementGranter.onSubmissionUpsert', () => {
  it('grants first_submission idempotently — repeat calls do not insert duplicates', async () => {
    const { prisma, rows } = makeFakePrisma({
      first_submission: { id: 'a_first', slug: 'first_submission' },
    })
    const granter = createAchievementGranter(prisma as never)
    await granter.onSubmissionUpsert({
      userId: 'u1',
      sprintId: 'sp1',
      submissionId: 's1',
      isCreate: true,
    })
    await granter.onSubmissionUpsert({
      userId: 'u1',
      sprintId: 'sp2',
      submissionId: 's2',
      isCreate: true,
    })
    expect(rows).toEqual([{ userId: 'u1', achievementId: 'a_first', sprintId: '' }])
    // Both attempts hit the DB via createMany, but skipDuplicates kept us to one row.
    expect(prisma.userAchievement.createMany).toHaveBeenCalledTimes(2)
  })

  it('does not grant on isCreate=false', async () => {
    const { prisma, rows } = makeFakePrisma({
      first_submission: { id: 'a_first', slug: 'first_submission' },
    })
    const granter = createAchievementGranter(prisma as never)
    await granter.onSubmissionUpsert({
      userId: 'u1',
      sprintId: 'sp1',
      submissionId: 's1',
      isCreate: false,
    })
    expect(rows).toHaveLength(0)
    expect(prisma.userAchievement.createMany).not.toHaveBeenCalled()
  })

  it('two simultaneous first-ever submissions cannot double-grant', async () => {
    // Simulates the original race: previously both calls saw `count === 1` and granted twice.
    // With createMany+skipDuplicates the second one no-ops at the DB layer.
    const { prisma, rows } = makeFakePrisma({
      first_submission: { id: 'a_first', slug: 'first_submission' },
    })
    const granter = createAchievementGranter(prisma as never)
    await Promise.all([
      granter.onSubmissionUpsert({
        userId: 'u1',
        sprintId: 'sp1',
        submissionId: 's1',
        isCreate: true,
      }),
      granter.onSubmissionUpsert({
        userId: 'u1',
        sprintId: 'sp2',
        submissionId: 's2',
        isCreate: true,
      }),
    ])
    expect(rows.filter((r) => r.achievementId === 'a_first')).toHaveLength(1)
  })
})

describe('achievementGranter.onSubmissionStatusChange — sprint_winner reassignment', () => {
  it('revokes the previous winner when a new top submission appears', async () => {
    const { prisma, rows } = makeFakePrisma(
      {
        first_accepted: { id: 'a_acc', slug: 'first_accepted' },
        sprint_winner: { id: 'a_win', slug: 'sprint_winner' },
      },
      { topSubmission: { id: 's_old', userId: 'u_old' } }
    )
    const granter = createAchievementGranter(prisma as never)
    await granter.onSubmissionStatusChange({
      userId: 'u_old',
      sprintId: 'sp1',
      submissionId: 's_old',
      status: 'ACCEPTED',
      mentorScore: 50,
    })
    // After the first round: u_old holds the sprint_winner for sp1.
    expect(
      rows.some(
        (r) => r.achievementId === 'a_win' && r.userId === 'u_old' && r.sprintId === 'sp1'
      )
    ).toBe(true)

    // A higher-scoring submission lands. Top is now u_new.
    prisma.submission.findFirst = vi.fn(async () => ({ id: 's_new', userId: 'u_new' }))
    await granter.onSubmissionStatusChange({
      userId: 'u_new',
      sprintId: 'sp1',
      submissionId: 's_new',
      status: 'ACCEPTED',
      mentorScore: 90,
    })
    const winners = rows.filter((r) => r.achievementId === 'a_win' && r.sprintId === 'sp1')
    expect(winners).toEqual([{ userId: 'u_new', achievementId: 'a_win', sprintId: 'sp1' }])
  })

  it('keeps winner unchanged when the same user remains top', async () => {
    const { prisma, rows } = makeFakePrisma(
      {
        first_accepted: { id: 'a_acc', slug: 'first_accepted' },
        sprint_winner: { id: 'a_win', slug: 'sprint_winner' },
      },
      { topSubmission: { id: 's_first', userId: 'u1' } }
    )
    const granter = createAchievementGranter(prisma as never)
    await granter.onSubmissionStatusChange({
      userId: 'u1',
      sprintId: 'sp1',
      submissionId: 's_first',
      status: 'ACCEPTED',
      mentorScore: 80,
    })
    await granter.onSubmissionStatusChange({
      userId: 'u1',
      sprintId: 'sp1',
      submissionId: 's_first',
      status: 'ACCEPTED',
      mentorScore: 85,
    })
    const winners = rows.filter((r) => r.achievementId === 'a_win' && r.sprintId === 'sp1')
    expect(winners).toEqual([{ userId: 'u1', achievementId: 'a_win', sprintId: 'sp1' }])
  })

  it('grants score_100 when mentorScore >= 100, idempotently', async () => {
    const { prisma, rows } = makeFakePrisma(
      {
        first_accepted: { id: 'a_acc', slug: 'first_accepted' },
        score_100: { id: 'a_100', slug: 'score_100' },
        sprint_winner: { id: 'a_win', slug: 'sprint_winner' },
      },
      { topSubmission: null }
    )
    const granter = createAchievementGranter(prisma as never)
    await granter.onSubmissionStatusChange({
      userId: 'u1',
      sprintId: 'sp1',
      submissionId: 's1',
      status: 'ACCEPTED',
      mentorScore: 100,
    })
    await granter.onSubmissionStatusChange({
      userId: 'u1',
      sprintId: 'sp2',
      submissionId: 's2',
      status: 'ACCEPTED',
      mentorScore: 100,
    })
    expect(rows.filter((r) => r.achievementId === 'a_100')).toHaveLength(1)
  })

  it('does nothing for non-ACCEPTED status', async () => {
    const { prisma, rows } = makeFakePrisma({
      first_accepted: { id: 'a_acc', slug: 'first_accepted' },
    })
    const granter = createAchievementGranter(prisma as never)
    await granter.onSubmissionStatusChange({
      userId: 'u1',
      sprintId: 'sp1',
      submissionId: 's1',
      status: 'PENDING',
      mentorScore: 100,
    })
    expect(rows).toHaveLength(0)
  })
})
