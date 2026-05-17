/**
 * Race-condition tests for the four fixes on this branch:
 *   1. Sprint.active — partial unique index + serializable activation.
 *   2. Submission upsert — atomic isCreate via Postgres `xmax = 0`.
 *   3. first_submission achievement — idempotent under concurrent first submits.
 *   4. sprint_winner achievement — gets reassigned when leaderboard top changes.
 *
 * Runs only when INTEGRATION=1 (testcontainers spin up Postgres). Skipped otherwise.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import RedisMock from 'ioredis-mock'
import type { PrismaClient as PrismaClientType } from '@prisma/client'
import type { Redis as RedisType } from 'ioredis'
import { buildContainer, type Container } from '../../src/container.js'
import { setRedisForTests } from '../../src/infra/redis.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const bffRoot = path.resolve(here, '../..')
const RUN_INTEGRATION = process.env.INTEGRATION === '1'
const conditionalDescribe = RUN_INTEGRATION ? describe : describe.skip

conditionalDescribe('race conditions', () => {
  let pgContainer: StartedPostgreSqlContainer
  let prisma: PrismaClientType
  let services: Container

  beforeAll(async () => {
    pgContainer = await new PostgreSqlContainer('postgres:16')
      .withDatabase('basalt')
      .withUsername('basalt')
      .withPassword('basalt')
      .start()
    const url = `${pgContainer.getConnectionUri()}?schema=bff`
    process.env.DATABASE_URL = url

    execSync('npx prisma migrate deploy', {
      cwd: bffRoot,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
    })

    const { PrismaClient } = await import('@prisma/client')
    prisma = new PrismaClient({ datasources: { db: { url } } })
    setRedisForTests(new (RedisMock as unknown as typeof RedisType)() as never)
    services = buildContainer(prisma)
  }, 180_000)

  afterAll(async () => {
    await prisma?.$disconnect()
    await pgContainer?.stop()
  })

  beforeEach(async () => {
    await prisma.solutionLike.deleteMany()
    await prisma.notification.deleteMany()
    await prisma.submission.deleteMany()
    await prisma.sprintAccess.deleteMany()
    await prisma.userAchievement.deleteMany()
    await prisma.achievement.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.user.deleteMany()
    await prisma.sprint.deleteMany()

    // Seed the auto-granted achievements the granter looks up by slug.
    await prisma.achievement.createMany({
      data: [
        { slug: 'first_submission', title: 'Первый шаг', subtitle: '', icon: 'flag' },
        { slug: 'first_accepted', title: 'Принято', subtitle: '', icon: 'verified' },
        { slug: 'score_100', title: 'Сотка', subtitle: '', icon: 'military_tech' },
        { slug: 'sprint_winner', title: 'Чемпион', subtitle: '', icon: 'emoji_events' },
      ],
      skipDuplicates: true,
    })
  })

  async function makeSprint(slug: string, opts: { active?: boolean } = {}) {
    return prisma.sprint.create({
      data: {
        slug,
        title: `Sprint ${slug}`,
        tabLabel: slug,
        tabIcon: 'deployed_code',
        completedLabel: 'Активный',
        active: opts.active ?? false,
        brief: {},
        metrics: {},
      },
    })
  }

  async function makeUser(handle: string) {
    return prisma.user.create({
      data: {
        email: `${handle}@example.com`,
        handle,
        passwordHash: 'x',
        avatarUrl: `/avatar/${handle}`,
      },
    })
  }

  describe('Sprint.active partial unique + serializable activation', () => {
    it('parallel "set active" on two different sprints leaves exactly one active', async () => {
      const admin = await prisma.user.create({
        data: {
          email: 'admin1@example.com',
          handle: 'admin1',
          passwordHash: 'x',
          avatarUrl: '/a',
          role: 'ADMIN',
        },
      })
      const a = await makeSprint('parallel-a')
      const b = await makeSprint('parallel-b')

      // Fire concurrent activations. The partial unique index + SERIALIZABLE retry
      // must serialize them; whichever commits last wins.
      const results = await Promise.allSettled([
        services.admin.setActiveSprint(admin.id, a.id),
        services.admin.setActiveSprint(admin.id, b.id),
      ])
      for (const r of results) expect(r.status).toBe('fulfilled')

      const actives = await prisma.sprint.findMany({ where: { active: true } })
      expect(actives).toHaveLength(1)
      expect([a.id, b.id]).toContain(actives[0].id)
    })

    it('rapid back-and-forth toggling keeps the invariant', async () => {
      const admin = await prisma.user.create({
        data: {
          email: 'admin2@example.com',
          handle: 'admin2',
          passwordHash: 'x',
          avatarUrl: '/a',
          role: 'ADMIN',
        },
      })
      const a = await makeSprint('toggle-a')
      const b = await makeSprint('toggle-b')

      for (let i = 0; i < 5; i++) {
        await Promise.allSettled([
          services.admin.setActiveSprint(admin.id, a.id),
          services.admin.setActiveSprint(admin.id, b.id),
        ])
        const actives = await prisma.sprint.findMany({ where: { active: true } })
        expect(actives.length).toBeLessThanOrEqual(1)
      }
    })

    it('partial unique index is enforced at the DB layer (raw insert)', async () => {
      const a = await makeSprint('uniq-a', { active: true })
      await expect(
        prisma.sprint.create({
          data: {
            slug: 'uniq-b',
            title: 'B',
            tabLabel: 'B',
            completedLabel: 'Активный',
            active: true,
            brief: {},
            metrics: {},
          },
        })
      ).rejects.toMatchObject({ code: 'P2002' })
      // a stays active
      const stillActive = await prisma.sprint.findUnique({ where: { id: a.id } })
      expect(stillActive?.active).toBe(true)
    })
  })

  describe('Submission atomic upsert + first_submission idempotency', () => {
    it('two concurrent first submits by same user grant first_submission once', async () => {
      const sprintA = await makeSprint('first-a', { active: true })
      const sprintB = await makeSprint('first-b')
      const user = await makeUser('u_first')
      // Grant submit access on both sprints.
      await prisma.sprintAccess.createMany({
        data: [
          { userId: user.id, sprintId: sprintA.id, canSubmit: true, canView: true },
          { userId: user.id, sprintId: sprintB.id, canSubmit: true, canView: true },
        ],
      })

      // Submit to two sprints in parallel. Both are "isCreate=true" because they're
      // different rows; previously the count==1 gate would either grant twice or zero.
      await Promise.all([
        services.submissions.submit({
          userId: user.id,
          sprintId: sprintA.id,
          repoUrl: 'https://example.com/a',
        }),
        services.submissions.submit({
          userId: user.id,
          sprintId: sprintB.id,
          repoUrl: 'https://example.com/b',
        }),
      ])

      const firstAch = await prisma.achievement.findUniqueOrThrow({
        where: { slug: 'first_submission' },
      })
      const rows = await prisma.userAchievement.findMany({
        where: { userId: user.id, achievementId: firstAch.id },
      })
      expect(rows).toHaveLength(1)
    })

    it('two concurrent submits to the SAME sprint result in exactly one Submission row', async () => {
      const sprint = await makeSprint('dup', { active: true })
      const user = await makeUser('u_dup')
      await prisma.sprintAccess.create({
        data: { userId: user.id, sprintId: sprint.id, canSubmit: true, canView: true },
      })

      const results = await Promise.allSettled([
        services.submissions.submit({
          userId: user.id,
          sprintId: sprint.id,
          repoUrl: 'https://example.com/a',
        }),
        services.submissions.submit({
          userId: user.id,
          sprintId: sprint.id,
          repoUrl: 'https://example.com/b',
        }),
      ])
      // Both succeed (atomic upsert).
      for (const r of results) expect(r.status).toBe('fulfilled')

      const subs = await prisma.submission.findMany({
        where: { userId: user.id, sprintId: sprint.id },
      })
      expect(subs).toHaveLength(1)
    })
  })

  describe('sprint_winner reassignment', () => {
    it('higher-scoring submission steals the badge from the previous winner', async () => {
      const sprint = await makeSprint('winner', { active: true })
      const alice = await makeUser('alice_w')
      const bob = await makeUser('bob_w')

      const aliceSub = await prisma.submission.create({
        data: {
          userId: alice.id,
          sprintId: sprint.id,
          repoUrl: 'https://example.com/alice',
          status: 'ACCEPTED',
          mentorScore: 70,
        },
      })

      // First winner pass.
      await services.achievementGranter.onSubmissionStatusChange({
        userId: alice.id,
        sprintId: sprint.id,
        submissionId: aliceSub.id,
        status: 'ACCEPTED',
        mentorScore: 70,
      })

      const winnerAch = await prisma.achievement.findUniqueOrThrow({
        where: { slug: 'sprint_winner' },
      })
      const aliceWinner = await prisma.userAchievement.findMany({
        where: { userId: alice.id, achievementId: winnerAch.id, sprintId: sprint.id },
      })
      expect(aliceWinner).toHaveLength(1)

      // Bob lands a higher score in the same sprint.
      const bobSub = await prisma.submission.create({
        data: {
          userId: bob.id,
          sprintId: sprint.id,
          repoUrl: 'https://example.com/bob',
          status: 'ACCEPTED',
          mentorScore: 95,
        },
      })
      await services.achievementGranter.onSubmissionStatusChange({
        userId: bob.id,
        sprintId: sprint.id,
        submissionId: bobSub.id,
        status: 'ACCEPTED',
        mentorScore: 95,
      })

      const winnersAfter = await prisma.userAchievement.findMany({
        where: { achievementId: winnerAch.id, sprintId: sprint.id },
      })
      expect(winnersAfter).toHaveLength(1)
      expect(winnersAfter[0].userId).toBe(bob.id)
    })

    it('winning two different sprints is allowed (separate sprintId rows)', async () => {
      const s1 = await makeSprint('multi-1', { active: false })
      const s2 = await makeSprint('multi-2', { active: false })
      const u = await makeUser('multi_winner')

      for (const sp of [s1, s2]) {
        const sub = await prisma.submission.create({
          data: {
            userId: u.id,
            sprintId: sp.id,
            repoUrl: `https://example.com/${sp.slug}`,
            status: 'ACCEPTED',
            mentorScore: 80,
          },
        })
        await services.achievementGranter.onSubmissionStatusChange({
          userId: u.id,
          sprintId: sp.id,
          submissionId: sub.id,
          status: 'ACCEPTED',
          mentorScore: 80,
        })
      }
      const winnerAch = await prisma.achievement.findUniqueOrThrow({
        where: { slug: 'sprint_winner' },
      })
      const rows = await prisma.userAchievement.findMany({
        where: { userId: u.id, achievementId: winnerAch.id },
        orderBy: { sprintId: 'asc' },
      })
      expect(rows.map((r) => r.sprintId).sort()).toEqual([s1.id, s2.id].sort())
    })
  })
})
