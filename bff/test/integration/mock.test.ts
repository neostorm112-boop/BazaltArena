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
let testIpCounter = 110

function registerMember(app: Express, body: { email: string; handle: string; password: string }) {
  testIpCounter += 1
  return request(app)
    .post('/api/mock/v1/auth/register')
    .set('x-dev-register-key', REGISTER_KEY)
    .set('x-forwarded-for', `127.0.2.${testIpCounter}`)
    .send(body)
}

conditionalDescribe('BFF mock contract (external front)', () => {
  let container: StartedPostgreSqlContainer
  let prisma: PrismaClientType
  let app: Express

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16')
      .withDatabase('basalt')
      .withUsername('basalt')
      .withPassword('basalt')
      .start()
    const url = `${container.getConnectionUri()}?schema=bff_mock`
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
        slug: 'sprint-mock-test',
        title: '#7 Mock Test',
        tabLabel: '#7 Mock Test',
        tabIcon: 'deployed_code',
        completedLabel: 'Активный',
        active: true,
        published: true,
        archived: false,
        brief: { sprintPath: '/' },
        metrics: { prizeRub: 50_000 },
      },
    })
    // Авто-достижение first_submission и пр.
    await prisma.achievement.createMany({
      data: [
        { slug: 'first_submission', title: 'Первый шаг', subtitle: 'Отправил первое решение', icon: 'flag' },
        { slug: 'first_accepted', title: 'Принято', subtitle: 'Первое решение принято', icon: 'verified' },
        { slug: 'score_100', title: 'Сотка', subtitle: '100 баллов', icon: 'military_tech' },
        { slug: 'sprint_winner', title: 'Чемпион', subtitle: 'Лучший в спринте', icon: 'emoji_events' },
        { slug: 'popular_solution', title: 'Народный любимец', subtitle: '25+ лайков', icon: 'favorite' },
      ],
      skipDuplicates: true,
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

  it('mock auth: register/login/logout с верным форматом ответа', async () => {
    const reg = await registerMember(app, {
      email: 'mock-a@example.com',
      handle: 'mocka',
      password: 'password123',
    }).expect(201)
    expect(reg.body.accessToken).toBeTruthy()
    expect(reg.body.user.handle).toBe('mocka')

    const login = await request(app)
      .post('/api/mock/v1/auth/login')
      .set('x-forwarded-for', '127.0.2.200')
      .send({ email: 'mock-a@example.com', password: 'password123' })
      .expect(200)
    expect(login.body.accessToken).toBeTruthy()

    const logout = await request(app)
      .post('/api/mock/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
    expect(logout.body.ok).toBe(true)
  })

  it('mock /v2/me возвращает nested-shape совместимый с normalizeMeFromV2', async () => {
    const reg = await registerMember(app, {
      email: 'mock-b@example.com',
      handle: 'mockb',
      password: 'password123',
    }).expect(201)
    const token = reg.body.accessToken

    const me = await request(app)
      .get('/api/mock/v1/v2/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(me.body.user.handle).toBe('mockb')
    expect(me.body.user.profile.bio).toBeDefined()
    expect(me.body.user.profile.contacts).toBeDefined()
    expect(me.body.user.profile.form).toBeDefined()
    expect(me.body.user.stats.globalRank).toMatch(/^#\d+$/)
    expect(Array.isArray(me.body.user.stats.cards)).toBe(true)
    expect(me.body.user.sprintContext.activeSprint).not.toBeNull()
    expect(me.body.user.notifications.unreadCount).toBeDefined()
    expect(Array.isArray(me.body.user.achievements)).toBe(true)
  })

  it('mock /v2/meta возвращает агрегаты из БД', async () => {
    const meta = await request(app).get('/api/mock/v1/v2/meta').expect(200)
    expect(meta.body.app.build).toBeTruthy()
    expect(meta.body.app.copyrightYear).toBeGreaterThan(2020)
    expect(meta.body.server.timeUtcDisplay).toMatch(/^\d{2}:\d{2}$/)
    expect(meta.body.sprintTeaser.sprintNumber).toBeGreaterThan(0)
    expect(meta.body.marketing.fighters).toBeGreaterThanOrEqual(0)
    expect(meta.body.marketing.prizePoolShort).toBeTruthy()
    expect(meta.body.marketing.prizeCurrency).toBe('₽')
  })

  it('mock /v2/sprints: list+detail работает с сортировкой', async () => {
    const reg = await registerMember(app, {
      email: 'mock-c@example.com',
      handle: 'mockc',
      password: 'password123',
    }).expect(201)
    const token = reg.body.accessToken

    const list = await request(app)
      .get('/api/mock/v1/v2/sprints')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(Array.isArray(list.body.sprints)).toBe(true)
    const first = list.body.sprints[0]
    expect(first.id).toBeTruthy()

    const detail = await request(app)
      .get(`/api/mock/v1/v2/sprints/${first.id}?sortBy=likes`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    expect(detail.body.sprint.id).toBe(first.id)
    expect(Array.isArray(detail.body.sprint.solutions)).toBe(true)
    expect(detail.body.sprint.metrics).toBeDefined()
  })

  it('mock /v2/submissions: создание + авто-выдача first_submission', async () => {
    const reg = await registerMember(app, {
      email: 'mock-d@example.com',
      handle: 'mockd',
      password: 'password123',
    }).expect(201)
    const token = reg.body.accessToken

    const submit = await request(app)
      .post('/api/mock/v1/v2/submissions')
      .set('Authorization', `Bearer ${token}`)
      .send({ repoUrl: 'https://github.com/mockd/repo', demoUrl: 'https://demo.example.com' })
      .expect(201)
    expect(submit.body.id).toBeTruthy()

    const me = await request(app)
      .get('/api/mock/v1/v2/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
    const earned = (me.body.user.achievements as Array<{ id: string; variant: string }>).find(
      (a) => a.variant === 'earned'
    )
    expect(earned).toBeDefined()
  })

  it('mock-ошибки приходят в формате { error: "..." }', async () => {
    const res = await request(app)
      .get('/api/mock/v1/v2/me')
      .expect(401)
    expect(res.body.error).toBeTruthy()
    expect(res.body.code).toBeUndefined()
  })
})
