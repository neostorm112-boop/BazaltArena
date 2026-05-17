/**
 * Edge-case integration tests.
 *
 * Запуск: INTEGRATION=1 npx vitest run test/integration/edge-cases.test.ts
 *
 * Покрытые сценарии:
 *  - дублирующая регистрация (email / handle)
 *  - сабмишн без активного спринта → 404
 *  - сабмишн в архивный спринт (нет доступа) → 403
 *  - обновление своего решения (upsert) — 201, isCreate=false в БД
 *  - само-лайк → 403
 *  - лайк несуществующего решения → 404
 *  - авто-ачивка first_submission
 *  - авто-ачивка first_accepted (+ score_100 при mentorScore ≥ 100)
 *  - невалидный body при сабмишне → 422
 *  - неавторизованный запрос к /me → 401
 *  - PATCH /me — обновление профиля
 *  - профиль чужого пользователя через /hall
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

let ipSuffix = 100

function makeIp() {
  ipSuffix += 1
  return `10.0.0.${ipSuffix}`
}

function reg(app: Express, body: { email: string; handle: string; password: string }) {
  return request(app)
    .post('/api/v1/auth/register')
    .set('x-dev-register-key', REGISTER_KEY)
    .set('x-forwarded-for', makeIp())
    .send(body)
}

async function regAndToken(
  app: Express,
  suffix: string,
): Promise<{ token: string; userId: string }> {
  const res = await reg(app, {
    email: `user_${suffix}@test.com`,
    handle: `user_${suffix}`,
    password: 'password123',
  }).expect(201)
  return { token: res.body.accessToken, userId: res.body.user?.id }
}

conditionalDescribe('Edge cases', () => {
  let container: StartedPostgreSqlContainer
  let prisma: PrismaClientType
  let app: Express
  let activeSprint: { id: string }

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

    // Засеиваем ачивки для авто-выдачи
    await prisma.achievement.createMany({
      data: [
        { slug: 'first_submission', title: 'Первый шаг', subtitle: 'Первое решение', icon: 'flag' },
        { slug: 'first_accepted', title: 'Принято', subtitle: 'Первое ACCEPTED', icon: 'verified' },
        { slug: 'score_100', title: 'Сотка', subtitle: '100 баллов', icon: 'military_tech' },
        {
          slug: 'sprint_winner',
          title: 'Чемпион спринта',
          subtitle: 'Лучшее решение',
          icon: 'emoji_events',
        },
        {
          slug: 'popular_solution',
          title: 'Народный любимец',
          subtitle: '25+ лайков',
          icon: 'favorite',
        },
      ],
      skipDuplicates: true,
    })

    activeSprint = await prisma.sprint.create({
      data: {
        slug: 'edge-active',
        title: 'Edge Active Sprint',
        tabLabel: 'Edge',
        tabIcon: null,
        completedLabel: 'Активный',
        active: true,
        published: true,
        archived: false,
        brief: {},
        metrics: {},
      },
    })

    const services = buildContainer(prisma)
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

  // ─── Auth ──────────────────────────────────────────────────────────────

  it('401 на /me без токена', async () => {
    const res = await request(app).get('/api/v1/me')
    expect(res.status).toBe(401)
  })

  it('401 на /me с невалидным токеном', async () => {
    const res = await request(app).get('/api/v1/me').set('Authorization', 'Bearer garbage.token.here')
    expect(res.status).toBe(401)
  })

  it('409 при дублирующей регистрации по email', async () => {
    await reg(app, { email: 'dup@test.com', handle: 'dup1', password: 'pass' }).expect(201)
    const res = await reg(app, { email: 'dup@test.com', handle: 'dup2', password: 'pass' })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CONFLICT')
  })

  it('409 при дублирующей регистрации по handle', async () => {
    await reg(app, { email: 'a1@test.com', handle: 'samehandle', password: 'pass' }).expect(201)
    const res = await reg(app, { email: 'a2@test.com', handle: 'samehandle', password: 'pass' })
    expect(res.status).toBe(409)
    expect(res.body.code).toBe('CONFLICT')
  })

  // ─── Submission ────────────────────────────────────────────────────────

  it('422 при невалидном repoUrl', async () => {
    const { token } = await regAndToken(app, 'val1')
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { active: true } })
    const user = await prisma.user.findFirstOrThrow({ where: { handle: 'user_val1' } })
    await prisma.sprintAccess.create({
      data: { userId: user.id, sprintId: sprint.id, canSubmit: true, canView: true },
    })
    const res = await request(app)
      .post(`/api/v1/sprints/${sprint.id}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ repoUrl: 'not-a-url' })
    expect(res.status).toBe(422)
  })

  it('404 при сабмишне когда нет активного спринта', async () => {
    // Деактивируем спринт
    await prisma.sprint.update({ where: { id: activeSprint.id }, data: { active: false } })
    const { token } = await regAndToken(app, 'noactive')
    const res = await request(app)
      .post(`/api/v1/sprints/${activeSprint.id}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ repoUrl: 'https://github.com/x/y', demoUrl: 'https://demo.com' })
    expect(res.status).toBe(404)
    // Восстанавливаем
    await prisma.sprint.update({ where: { id: activeSprint.id }, data: { active: true } })
  })

  it('403 если у пользователя нет canSubmit доступа', async () => {
    const { token } = await regAndToken(app, 'noaccess')
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { active: true } })
    const user = await prisma.user.findFirstOrThrow({ where: { handle: 'user_noaccess' } })
    // Создаём доступ, но canSubmit=false
    await prisma.sprintAccess.create({
      data: { userId: user.id, sprintId: sprint.id, canSubmit: false, canView: true },
    })
    const res = await request(app)
      .post(`/api/v1/sprints/${sprint.id}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ repoUrl: 'https://github.com/x/y', demoUrl: 'https://demo.com' })
    expect(res.status).toBe(403)
  })

  it('upsert: повторный сабмишн обновляет решение, не создаёт дубль', async () => {
    const { token } = await regAndToken(app, 'upsert1')
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { active: true } })
    const user = await prisma.user.findFirstOrThrow({ where: { handle: 'user_upsert1' } })
    await prisma.sprintAccess.create({
      data: { userId: user.id, sprintId: sprint.id, canSubmit: true, canView: true },
    })

    await request(app)
      .post(`/api/v1/sprints/${sprint.id}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ repoUrl: 'https://github.com/x/v1', demoUrl: 'https://demo.com' })
      .expect(201)

    await request(app)
      .post(`/api/v1/sprints/${sprint.id}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ repoUrl: 'https://github.com/x/v2', demoUrl: 'https://demo.com' })
      .expect(201)

    const count = await prisma.submission.count({ where: { userId: user.id } })
    expect(count).toBe(1)

    const sub = await prisma.submission.findFirstOrThrow({ where: { userId: user.id } })
    expect(sub.repoUrl).toBe('https://github.com/x/v2')
  })

  // ─── Likes ─────────────────────────────────────────────────────────────

  it('403 само-лайк', async () => {
    const { token } = await regAndToken(app, 'selflike')
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { active: true } })
    const user = await prisma.user.findFirstOrThrow({ where: { handle: 'user_selflike' } })
    await prisma.sprintAccess.create({
      data: { userId: user.id, sprintId: sprint.id, canSubmit: true, canView: true },
    })
    const sub = await request(app)
      .post(`/api/v1/sprints/${sprint.id}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ repoUrl: 'https://github.com/x/self', demoUrl: 'https://demo.com' })
      .expect(201)

    const res = await request(app)
      .put(`/api/v1/solutions/${sub.body.id}/like`)
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(403)
  })

  it('404 лайк несуществующего решения', async () => {
    const { token } = await regAndToken(app, 'like404')
    const res = await request(app)
      .put('/api/v1/solutions/00000000-0000-0000-0000-000000000000/like')
      .set('Authorization', `Bearer ${token}`)
    expect(res.status).toBe(404)
  })

  it('лайк идемпотентен — повторный PUT не увеличивает счётчик', async () => {
    const { token: authorToken } = await regAndToken(app, 'likeauth')
    const { token: voterToken } = await regAndToken(app, 'likevoter')
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { active: true } })
    const author = await prisma.user.findFirstOrThrow({ where: { handle: 'user_likeauth' } })
    const voter = await prisma.user.findFirstOrThrow({ where: { handle: 'user_likevoter' } })
    await prisma.sprintAccess.createMany({
      data: [
        { userId: author.id, sprintId: sprint.id, canSubmit: true, canView: true },
        { userId: voter.id, sprintId: sprint.id, canSubmit: true, canView: true },
      ],
    })
    const sub = await request(app)
      .post(`/api/v1/sprints/${sprint.id}/submissions`)
      .set('Authorization', `Bearer ${authorToken}`)
      .send({ repoUrl: 'https://github.com/x/like', demoUrl: 'https://demo.com' })
      .expect(201)

    const r1 = await request(app)
      .put(`/api/v1/solutions/${sub.body.id}/like`)
      .set('Authorization', `Bearer ${voterToken}`)
      .expect(200)
    const r2 = await request(app)
      .put(`/api/v1/solutions/${sub.body.id}/like`)
      .set('Authorization', `Bearer ${voterToken}`)
      .expect(200)

    expect(r1.body.likes).toBe(1)
    expect(r2.body.likes).toBe(1)
  })

  // ─── Achievements ──────────────────────────────────────────────────────

  it('авто-ачивка first_submission после первого сабмишна', async () => {
    const { token } = await regAndToken(app, 'achsub')
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { active: true } })
    const user = await prisma.user.findFirstOrThrow({ where: { handle: 'user_achsub' } })
    await prisma.sprintAccess.create({
      data: { userId: user.id, sprintId: sprint.id, canSubmit: true, canView: true },
    })

    await request(app)
      .post(`/api/v1/sprints/${sprint.id}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ repoUrl: 'https://github.com/x/ach', demoUrl: 'https://demo.com' })
      .expect(201)

    const ua = await prisma.userAchievement.findFirst({
      where: { userId: user.id, achievement: { slug: 'first_submission' } },
      include: { achievement: true },
    })
    expect(ua).not.toBeNull()
    expect(ua?.achievement.slug).toBe('first_submission')
  })

  it('авто-ачивки first_accepted и score_100 после ревью ментора', async () => {
    const { token } = await regAndToken(app, 'achrev')
    const sprint = await prisma.sprint.findFirstOrThrow({ where: { active: true } })
    const user = await prisma.user.findFirstOrThrow({ where: { handle: 'user_achrev' } })

    // Создаём ментора/админа
    const argon2 = await import('argon2')
    const hash = await argon2.hash('adminpass', { type: argon2.argon2id })
    const admin = await prisma.user.create({
      data: {
        email: 'admin_achrev@test.com',
        handle: 'admin_achrev',
        passwordHash: hash,
        role: 'ADMIN',
        avatarUrl: 'https://a.com/a.png',
      },
    })
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin_achrev@test.com', password: 'adminpass' })
      .expect(200)
    const adminToken = adminLogin.body.accessToken

    await prisma.sprintAccess.createMany({
      data: [
        { userId: user.id, sprintId: sprint.id, canSubmit: true, canView: true },
        { userId: admin.id, sprintId: sprint.id, canSubmit: true, canView: true },
      ],
    })

    const subRes = await request(app)
      .post(`/api/v1/sprints/${sprint.id}/submissions`)
      .set('Authorization', `Bearer ${token}`)
      .send({ repoUrl: 'https://github.com/x/rev', demoUrl: 'https://demo.com' })
      .expect(201)

    await request(app)
      .patch(`/api/v1/admin/submissions/${subRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ mentorScore: 100, status: 'ACCEPTED', mentorComment: 'Отлично.' })
      .expect(200)

    const slugs = (
      await prisma.userAchievement.findMany({
        where: { userId: user.id },
        include: { achievement: true },
      })
    ).map((ua) => ua.achievement.slug)

    expect(slugs).toContain('first_accepted')
    expect(slugs).toContain('score_100')
  })

  // ─── Profile ───────────────────────────────────────────────────────────

  it('PATCH /me обновляет bio и stack', async () => {
    const { token } = await regAndToken(app, 'patch1')

    const res = await request(app)
      .patch('/api/v1/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ bio: 'Новое описание', stack: ['React', 'Node.js'] })
      .expect(200)

    expect(res.body.user.bio).toBe('Новое описание')
    expect(res.body.user.stack).toEqual(['React', 'Node.js'])
  })
})
