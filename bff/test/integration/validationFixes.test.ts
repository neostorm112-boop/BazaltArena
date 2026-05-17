/**
 * Integration tests for the four fixes on this branch
 * (companion to `validationSchemas.test.ts` — those cover Zod in isolation,
 * these check the full HTTP path including the error handler envelope):
 *
 *   1. repoUrl validation rejects javascript:, ftp:, localhost, RFC1918, oversize.
 *   2. Concurrent submissions deduplicate (atomic upsert) and the response is
 *      always the row that ended up in the DB — no "201 with one repoUrl while
 *      DB has the other" divergence.
 *   3. Sprint create/patch with past dates is rejected with 400 unless
 *      allowPast: true is set.
 *   4. PATCH /admin/submissions/:id rejects mentorScore > 100 with 400.
 *
 * Runs only with INTEGRATION=1 (testcontainers spin up Postgres). Skipped otherwise.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import RedisMock from 'ioredis-mock'
import request from 'supertest'
import type { Express } from 'express'
import type { PrismaClient as PrismaClientType } from '@prisma/client'
import type { Redis as RedisType } from 'ioredis'
import { buildContainer } from '../../src/container.js'
import { createApp } from '../../src/app.js'
import { setRedisForTests } from '../../src/infra/redis.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const bffRoot = path.resolve(here, '../..')

const RUN_INTEGRATION = process.env.INTEGRATION === '1'
const REGISTER_KEY = process.env.DEV_REGISTER_KEY ?? 'basalt-dev-register-key'
const conditionalDescribe = RUN_INTEGRATION ? describe : describe.skip
let ipCounter = 100

function registerMember(app: Express, body: { email: string; handle: string; password: string }) {
  ipCounter += 1
  return request(app)
    .post('/api/v1/auth/register')
    .set('x-dev-register-key', REGISTER_KEY)
    .set('x-forwarded-for', `127.0.2.${ipCounter}`)
    .send(body)
}

async function loginAdmin(app: Express, prisma: PrismaClientType, email: string) {
  const argon2 = await import('argon2')
  const hash = await argon2.hash('adminpass1', { type: argon2.argon2id })
  const admin = await prisma.user.create({
    data: {
      email,
      handle: email.split('@')[0],
      passwordHash: hash,
      role: 'ADMIN',
      avatarUrl: 'https://example.com/a.png',
    },
  })
  const login = await request(app)
    .post('/api/v1/auth/login')
    .set('x-forwarded-for', `127.0.3.${++ipCounter}`)
    .send({ email, password: 'adminpass1' })
    .expect(200)
  return { admin, token: login.body.accessToken as string }
}

conditionalDescribe('validation hardening — branch fix/submission-and-admin-validation', () => {
  let container: StartedPostgreSqlContainer
  let prisma: PrismaClientType
  let app: Express

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16')
      .withDatabase('basalt')
      .withUsername('basalt')
      .withPassword('basalt')
      .start()
    const url = `${container.getConnectionUri()}?schema=bff`
    process.env.DATABASE_URL = url
    // Force the always-on SSRF guard even if a local dev env happens to set it.
    delete process.env.ALLOW_PRIVATE_REPO_URLS

    execSync('npx prisma migrate deploy', {
      cwd: bffRoot,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
    })

    const { PrismaClient } = await import('@prisma/client')
    prisma = new PrismaClient({ datasources: { db: { url } } })
    setRedisForTests(new (RedisMock as unknown as typeof RedisType)() as never)

    const services = buildContainer(prisma)
    app = createApp({ prisma, container: services })
  }, 180_000)

  afterAll(async () => {
    await prisma?.$disconnect()
    await container?.stop()
  })

  beforeEach(async () => {
    await prisma.solutionLike.deleteMany()
    await prisma.notification.deleteMany()
    await prisma.submission.deleteMany()
    await prisma.sprintAccess.deleteMany()
    await prisma.userAchievement.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.user.deleteMany()
    await prisma.sprint.deleteMany()
    // A single open sprint for the member-flow tests.
    await prisma.sprint.create({
      data: {
        slug: 'open-sprint',
        title: 'Open Sprint',
        tabLabel: 'Open',
        completedLabel: 'Активный',
        active: true,
        published: true,
        archived: false,
        brief: {},
        metrics: {},
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })
  })

  describe('CASE 1: repoUrl validation', () => {
    async function postRepo(repoUrl: unknown) {
      const reg = await registerMember(app, {
        email: `m${ipCounter}@test.com`,
        handle: `m${ipCounter}`,
        password: 'password123',
      }).expect(201)
      return request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ repoUrl })
    }

    it('rejects javascript: scheme with 400', async () => {
      const res = await postRepo('javascript:alert(1)')
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('rejects ftp:// scheme with 400', async () => {
      const res = await postRepo('ftp://example.com/repo')
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('rejects http://localhost (SSRF) with 400', async () => {
      const res = await postRepo('http://localhost:1')
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('rejects 2000+ char URL with 400', async () => {
      const long = 'https://example.com/' + 'a'.repeat(2200)
      const res = await postRepo(long)
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('rejects RFC1918 host (192.168.x) with 400', async () => {
      const res = await postRepo('http://192.168.1.10/repo')
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('accepts a legitimate https GitHub URL with 201', async () => {
      const res = await postRepo('https://github.com/u/r')
      expect(res.status).toBe(201)
      expect(res.body.repoUrl).toBe('https://github.com/u/r')
    })
  })

  describe('CASE 2: concurrent submission upsert is atomic', () => {
    it('two parallel POSTs both return the same DB-resident repoUrl', async () => {
      const reg = await registerMember(app, {
        email: 'racey@test.com',
        handle: 'racey',
        password: 'password123',
      }).expect(201)
      const token = reg.body.accessToken
      const urlA = 'https://github.com/u/a'
      const urlB = 'https://github.com/u/b'

      // Fire both in parallel; whichever lands last wins, but both responses
      // must reflect the row that ended up in the DB (no "201 with A while DB has B").
      const [resA, resB] = await Promise.all([
        request(app)
          .post('/api/v1/submissions')
          .set('Authorization', `Bearer ${token}`)
          .send({ repoUrl: urlA }),
        request(app)
          .post('/api/v1/submissions')
          .set('Authorization', `Bearer ${token}`)
          .send({ repoUrl: urlB }),
      ])
      expect([resA.status, resB.status]).toEqual([201, 201])

      const dbRows = await prisma.submission.findMany({ where: { user: { handle: 'racey' } } })
      expect(dbRows.length).toBe(1)
      const winnerUrl = dbRows[0]!.repoUrl
      expect([urlA, urlB]).toContain(winnerUrl)

      // The IDs returned must match the single DB row; otherwise the client got told
      // "your submission is at id X" when X never existed.
      expect(resA.body.id).toBe(dbRows[0]!.id)
      expect(resB.body.id).toBe(dbRows[0]!.id)
    })
  })

  describe('CASE 3: admin sprint dates', () => {
    async function adminPost(body: Record<string, unknown>) {
      const { token } = await loginAdmin(app, prisma, `cre-${Date.now()}@test.com`)
      return request(app)
        .post('/api/v1/admin/sprints')
        .set('Authorization', `Bearer ${token}`)
        .send(body)
    }

    const baseSprintBody = {
      slug: `past-${Date.now()}`,
      title: 'Past Sprint',
      tabLabel: 'Past',
      completedLabel: 'Completed',
    }

    it('rejects sprint creation with past startsAt+endsAt (400)', async () => {
      const res = await adminPost({
        ...baseSprintBody,
        slug: 'past-1',
        startsAt: '2000-01-01T00:00:00.000Z',
        endsAt: '2000-02-01T00:00:00.000Z',
      })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })

    it('accepts sprint creation with past dates when allowPast: true', async () => {
      const res = await adminPost({
        ...baseSprintBody,
        slug: 'past-2',
        startsAt: '2000-01-01T00:00:00.000Z',
        endsAt: '2000-02-01T00:00:00.000Z',
        allowPast: true,
      })
      expect(res.status).toBe(201)
      const dbRow = await prisma.sprint.findFirst({ where: { slug: 'past-2' } })
      expect(dbRow).not.toBeNull()
    })

    it('rejects PATCH that moves endsAt into the past (400)', async () => {
      const sprint = await prisma.sprint.findFirstOrThrow({ where: { slug: 'open-sprint' } })
      const { token } = await loginAdmin(app, prisma, 'patcher@test.com')
      const res = await request(app)
        .patch(`/api/v1/admin/sprints/${sprint.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ endsAt: '2000-01-01T00:00:00.000Z' })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('CASE 4: mentorScore range', () => {
    it('rejects mentorScore=200 with 400 (no silent clamp)', async () => {
      const sprint = await prisma.sprint.findFirstOrThrow({ where: { slug: 'open-sprint' } })
      const reg = await registerMember(app, {
        email: 'scored@test.com',
        handle: 'scored',
        password: 'password123',
      }).expect(201)
      await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ repoUrl: 'https://github.com/u/r' })
        .expect(201)
      const submission = await prisma.submission.findFirstOrThrow({
        where: { sprintId: sprint.id },
      })

      const { token } = await loginAdmin(app, prisma, 'reviewer@test.com')
      const res = await request(app)
        .patch(`/api/v1/admin/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ mentorScore: 200 })
      expect(res.status).toBe(400)
      expect(res.body.code).toBe('VALIDATION_ERROR')

      // And the DB must not have been touched.
      const after = await prisma.submission.findUnique({ where: { id: submission.id } })
      expect(after?.mentorScore).toBe(0)
    })

    it('rejects negative mentorScore with 400', async () => {
      const sprint = await prisma.sprint.findFirstOrThrow({ where: { slug: 'open-sprint' } })
      const reg = await registerMember(app, {
        email: 'neg@test.com',
        handle: 'neg',
        password: 'password123',
      }).expect(201)
      await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ repoUrl: 'https://github.com/u/r' })
        .expect(201)
      const submission = await prisma.submission.findFirstOrThrow({
        where: { sprintId: sprint.id },
      })
      const { token } = await loginAdmin(app, prisma, 'rev2@test.com')
      const res = await request(app)
        .patch(`/api/v1/admin/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ mentorScore: -1 })
      expect(res.status).toBe(400)
    })

    it('accepts mentorScore=75 and persists it', async () => {
      const sprint = await prisma.sprint.findFirstOrThrow({ where: { slug: 'open-sprint' } })
      const reg = await registerMember(app, {
        email: 'ok@test.com',
        handle: 'okuser',
        password: 'password123',
      }).expect(201)
      await request(app)
        .post('/api/v1/submissions')
        .set('Authorization', `Bearer ${reg.body.accessToken}`)
        .send({ repoUrl: 'https://github.com/u/r' })
        .expect(201)
      const submission = await prisma.submission.findFirstOrThrow({
        where: { sprintId: sprint.id },
      })
      const { token } = await loginAdmin(app, prisma, 'rev3@test.com')
      const res = await request(app)
        .patch(`/api/v1/admin/submissions/${submission.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ mentorScore: 75 })
      expect(res.status).toBe(200)
      const after = await prisma.submission.findUnique({ where: { id: submission.id } })
      expect(after?.mentorScore).toBe(75)
    })
  })
})
