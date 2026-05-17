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
let testIpCounter = 10

function registerMember(app: Express, body: { email: string; handle: string; password: string }) {
  testIpCounter += 1
  return request(app)
    .post('/api/v1/auth/register')
    .set('x-dev-register-key', REGISTER_KEY)
    .set('x-forwarded-for', `127.0.1.${testIpCounter}`)
    .send(body)
}

conditionalDescribe('BFF integration', () => {
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

    execSync('npx prisma migrate deploy', {
      cwd: bffRoot,
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'inherit',
    })

    const { PrismaClient } = await import('@prisma/client')
    prisma = new PrismaClient({ datasources: { db: { url } } })

    setRedisForTests(new (RedisMock as unknown as typeof RedisType)() as never)

    const services = buildContainer(prisma)
    await prisma.sprint.create({
      data: {
        slug: 'sprint-test',
        title: 'Test Sprint',
        tabLabel: 'Test',
        tabIcon: 'deployed_code',
        completedLabel: 'Активный',
        active: true,
        brief: {},
        metrics: {},
      },
    })

    app = createApp({ prisma, container: services })
  }, 180_000)

  beforeEach(async () => {
    await prisma.solutionLike.deleteMany()
    await prisma.notification.deleteMany()
    await prisma.submission.deleteMany()
    await prisma.sprintAccess.deleteMany()
    await prisma.userAchievement.deleteMany()
    await prisma.auditLog.deleteMany()
    await prisma.user.deleteMany()
  })

  afterAll(async () => {
    await prisma?.$disconnect()
    await container?.stop()
  })

  it('register -> me -> submission -> like idempotency -> hall -> refresh -> logout', async () => {
    const registerRes = await registerMember(app, {
      email: 'alice@example.com',
      handle: 'alice',
      password: 'password123',
    }).expect(201)
    const access = registerRes.body.accessToken
    const refresh = registerRes.body.refreshToken
    expect(access).toBeTruthy()
    expect(refresh).toBeTruthy()

    const me = await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${access}`)
      .expect(200)
    expect(me.body.user.handle).toBe('alice')
    expect(me.body.activeSprint?.tabIcon).toBe('deployed_code')

    const sprint = await prisma.sprint.findFirstOrThrow()

    const submission = await request(app)
      .post(`/api/v1/sprints/${sprint.id}/submissions`)
      .set('Authorization', `Bearer ${access}`)
      .send({ repoUrl: 'https://github.com/alice/repo', demoUrl: 'https://demo.example.com' })
      .expect(201)
    const submissionId = submission.body.id

    const like1 = await request(app)
      .post(`/api/v1/solutions/${submissionId}/like`)
      .set('Authorization', `Bearer ${access}`)
      .expect(200)
    expect(like1.body.likes).toBe(1)
    expect(like1.body.liked).toBe(true)
    const like2 = await request(app)
      .post(`/api/v1/solutions/${submissionId}/like`)
      .set('Authorization', `Bearer ${access}`)
      .expect(200)
    expect(like2.body.likes).toBe(1)
    expect(like2.body.liked).toBe(true)

    const hall = await request(app)
      .get('/api/v1/hall?sortBy=likes')
      .set('Authorization', `Bearer ${access}`)
      .expect(200)
    const top = hall.body.sprints[0].solutions[0]
    expect(top.likes).toBe(1)
    expect(top.likedByMe).toBe(true)

    const unliked = await request(app)
      .delete(`/api/v1/solutions/${submissionId}/like`)
      .set('Authorization', `Bearer ${access}`)
      .expect(200)
    expect(unliked.body.likes).toBe(0)

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refresh })
      .expect(200)
    expect(refreshed.body.accessToken).not.toBe(access)

    await request(app).post('/api/v1/auth/refresh').send({ refreshToken: refresh }).expect(401)

    await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(200)
    await request(app)
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`)
      .expect(401)
  })

  it('rejects USER from admin API with 403', async () => {
    const registerRes = await registerMember(app, {
      email: 'member403@example.com',
      handle: 'member403',
      password: 'password123',
    }).expect(201)
    const token = registerRes.body.accessToken
    const res = await request(app)
      .get('/api/v1/admin/sprints')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('FORBIDDEN')
  })

  it('returns 409 CONFLICT on duplicate registration', async () => {
    await registerMember(app, {
      email: 'bob@example.com',
      handle: 'bob',
      password: 'password123',
    }).expect(201)
    const res = await registerMember(app, {
      email: 'bob@example.com',
      handle: 'bob_other',
      password: 'password123',
    })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CONFLICT')
  })

  it('admin PATCH submission updates sprint metrics', async () => {
    const argon2 = await import('argon2')
    const hash = await argon2.hash('adminpass1', { type: argon2.argon2id })
    const sprint = await prisma.sprint.findFirstOrThrow()
    const admin = await prisma.user.create({
      data: {
        email: 'admin-int@test.com',
        handle: 'adminint',
        passwordHash: hash,
        role: 'ADMIN',
        avatarUrl: 'https://example.com/a.png',
      },
    })
    await prisma.sprintAccess.create({
      data: { userId: admin.id, sprintId: sprint.id, canSubmit: true, canView: true },
    })
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin-int@test.com', password: 'adminpass1' })
      .expect(200)
    const token = login.body.accessToken

    const member = await prisma.user.create({
      data: {
        email: 'mem@test.com',
        handle: 'mem',
        passwordHash: hash,
        role: 'USER',
        avatarUrl: 'https://example.com/m.png',
      },
    })
    await prisma.sprintAccess.create({
      data: { userId: member.id, sprintId: sprint.id, canSubmit: true, canView: true },
    })
    const sub = await prisma.submission.create({
      data: {
        userId: member.id,
        sprintId: sprint.id,
        repoUrl: 'https://github.com/x/y',
        mentorScore: 0,
        status: 'PENDING',
      },
    })

    await request(app)
      .patch(`/api/v1/admin/submissions/${sub.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ mentorScore: 77, status: 'REVIEWED', mentorComment: 'Отличная работа по структуре.' })
      .expect(200)

    const updatedSub = await prisma.submission.findUniqueOrThrow({ where: { id: sub.id } })
    expect(updatedSub.mentorComment).toBe('Отличная работа по структуре.')

    const updatedSprint = await prisma.sprint.findUniqueOrThrow({ where: { id: sprint.id } })
    const metrics = updatedSprint.metrics as { verifiedSolutions?: number; submissions?: number }
    expect(metrics.submissions).toBe(1)
    expect(metrics.verifiedSolutions).toBeGreaterThanOrEqual(1)
  })

  describe('like endpoint REST semantics', () => {
    async function setup() {
      const reg = await registerMember(app, {
        email: `liker-${Math.random().toString(36).slice(2, 8)}@x.com`,
        handle: `liker_${Math.random().toString(36).slice(2, 8)}`,
        password: 'password123',
      }).expect(201)
      const access = reg.body.accessToken
      const sprint = await prisma.sprint.findFirstOrThrow()
      const sub = await request(app)
        .post(`/api/v1/sprints/${sprint.id}/submissions`)
        .set('Authorization', `Bearer ${access}`)
        .send({ repoUrl: 'https://github.com/x/y', demoUrl: 'https://demo.example.com' })
        .expect(201)
      return { access, submissionId: sub.body.id as string }
    }

    it('POST then POST is idempotent and does not bump counter', async () => {
      const { access, submissionId } = await setup()
      const first = await request(app)
        .post(`/api/v1/solutions/${submissionId}/like`)
        .set('Authorization', `Bearer ${access}`)
        .expect(200)
      expect(first.body).toMatchObject({ submissionId, liked: true, likes: 1 })
      const second = await request(app)
        .post(`/api/v1/solutions/${submissionId}/like`)
        .set('Authorization', `Bearer ${access}`)
        .expect(200)
      expect(second.body).toMatchObject({ submissionId, liked: true, likes: 1 })
      const row = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } })
      expect(row.likesCount).toBe(1)
    })

    it('DELETE on absent like is idempotent — no side effect on counter', async () => {
      const { access, submissionId } = await setup()
      // Start with no like at all.
      const first = await request(app)
        .delete(`/api/v1/solutions/${submissionId}/like`)
        .set('Authorization', `Bearer ${access}`)
        .expect(200)
      expect(first.body).toMatchObject({ submissionId, liked: false, likes: 0 })
      const second = await request(app)
        .delete(`/api/v1/solutions/${submissionId}/like`)
        .set('Authorization', `Bearer ${access}`)
        .expect(200)
      expect(second.body).toMatchObject({ submissionId, liked: false, likes: 0 })
      const row = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } })
      expect(row.likesCount).toBe(0)
    })

    it('repeated DELETE after a real like never drives counter negative', async () => {
      const { access, submissionId } = await setup()
      await request(app)
        .post(`/api/v1/solutions/${submissionId}/like`)
        .set('Authorization', `Bearer ${access}`)
        .expect(200)
      await request(app)
        .delete(`/api/v1/solutions/${submissionId}/like`)
        .set('Authorization', `Bearer ${access}`)
        .expect(200)
      for (let i = 0; i < 3; i += 1) {
        const r = await request(app)
          .delete(`/api/v1/solutions/${submissionId}/like`)
          .set('Authorization', `Bearer ${access}`)
          .expect(200)
        expect(r.body.likes).toBe(0)
      }
      const row = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } })
      expect(row.likesCount).toBe(0)
    })

    it('PUT alias still works but is marked deprecated', async () => {
      const { access, submissionId } = await setup()
      const res = await request(app)
        .put(`/api/v1/solutions/${submissionId}/like`)
        .set('Authorization', `Bearer ${access}`)
        .expect(200)
      expect(res.body).toMatchObject({ submissionId, liked: true, likes: 1 })
      expect(res.headers.deprecation).toBe('true')
    })

    it('parallel POSTs from the same user collapse to a single like', async () => {
      const { access, submissionId } = await setup()
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(app)
            .post(`/api/v1/solutions/${submissionId}/like`)
            .set('Authorization', `Bearer ${access}`)
        )
      )
      for (const r of results) {
        expect(r.status).toBe(200)
        expect(r.body.liked).toBe(true)
      }
      const row = await prisma.submission.findUniqueOrThrow({ where: { id: submissionId } })
      expect(row.likesCount).toBe(1)
      const likeRows = await prisma.solutionLike.findMany({ where: { submissionId } })
      expect(likeRows).toHaveLength(1)
    })
  })
})
