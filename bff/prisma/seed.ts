import argon2 from 'argon2'
import { config as loadDotenv } from 'dotenv'
import type { Prisma } from '@prisma/client'
import { PrismaClient, SubmissionStatus, UserRole } from '@prisma/client'

loadDotenv()

const prisma = new PrismaClient()
const DAY_MS = 24 * 3600 * 1000

const avatar = (seed: string) =>
  `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(seed)}&scale=62&radius=12`

type SeedSprint = {
  slug: string
  title: string
  tabLabel: string
  tabIcon: string | null
  completedLabel: string
  tags: string[]
  active: boolean
  published: boolean
  archived: boolean
  startsAt: Date | null
  endsAt: Date | null
  brief: Prisma.InputJsonValue
  metrics: Prisma.InputJsonValue
}

type SeedUser = {
  email: string
  handle: string
  role: UserRole
  bio: string
  skillsLabel: string
  realName: string
  stack: string[]
  telegram: string
  githubUrl: string
  points: number
  moneyEarned: number
  achievements?: string[]
}

const SPRINTS = [
  {
    slug: 'sprint-2-basalt-arena',
    title: '#2 Basalt Arena (frontend)',
    tabLabel: '#2 Basalt Arena (frontend)',
    tabIcon: 'deployed_code',
    completedLabel: 'Активный спринт',
    tags: ['HTML', 'Tailwind CSS', 'React'],
    active: true,
    published: true,
    archived: false,
    startsAt: new Date(Date.now() - DAY_MS),
    endsAt: new Date(Date.now() + 6 * DAY_MS),
    brief: {
      quote:
        'Перед вами макет той самой платформы, на которой вы сейчас находитесь. Ваша задача — сверстать его.',
      taskParagraphs: [
        {
          chunks: [
            'Реализуйте все три страницы по макету: главный экран спринта, зал славы, профиль. Стек — любой.',
          ],
        },
      ],
      acceptanceTitle: 'Критерии приёмки',
      acceptanceItems: [
        { parts: ['Соответствие макету.'] },
        { parts: ['JS-функционал должен работать без бэка.'] },
      ],
      resourceLinks: [
        { label: 'Figma-макет', href: '#', icon: 'view_quilt' },
        { label: 'Гайд по API', href: '#', icon: 'code' },
      ],
      sprintPath: '/',
    },
    metrics: {
      submissions: 0,
      submissionsBarPct: 0,
      deltaLabel: 'Старт спринта',
      successRate: '—',
      verifiedSolutions: 0,
    },
  },
  {
    slug: 'sprint-1-listea',
    title: '#1 Listea',
    tabLabel: '#1 Listea',
    tabIcon: null,
    completedLabel: 'Завершён 2 марта',
    tags: ['Vue', 'Pinia'],
    active: false,
    published: true,
    archived: false,
    startsAt: new Date('2026-02-15'),
    endsAt: new Date('2026-03-02'),
    brief: {
      quote: 'Spring #1 — отдельное задание в экосистеме Vue.',
      taskParagraphs: [{ chunks: ['Подробности — в материалах спринта.'] }],
      acceptanceTitle: 'Критерии приёмки',
      acceptanceItems: [{ parts: ['Соответствие ТЗ.'] }],
      resourceLinks: [],
      sprintPath: '/',
    },
    metrics: {
      submissions: 892,
      submissionsBarPct: 62,
      deltaLabel: '+4% к прошлому спринту',
      successRate: '38,1%',
      verifiedSolutions: 340,
    },
  },
  {
    slug: 'sprint-3-ai-dashboard',
    title: '#3 AI Dashboard',
    tabLabel: '#3 AI Dashboard',
    tabIcon: 'dashboard_customize',
    completedLabel: 'Черновик',
    tags: ['React', 'Charts', 'UX'],
    active: false,
    published: false,
    archived: false,
    startsAt: new Date(Date.now() + 10 * DAY_MS),
    endsAt: new Date(Date.now() + 17 * DAY_MS),
    brief: {
      quote: 'Будущий спринт: собрать аналитический дашборд для команды продукта.',
      taskParagraphs: [{ chunks: ['Черновик задания. Пока скрыт из публичного интерфейса.'] }],
      acceptanceTitle: 'Критерии приёмки',
      acceptanceItems: [{ parts: ['Будут опубликованы перед стартом.'] }],
      resourceLinks: [],
      sprintPath: '/',
    },
    metrics: {
      submissions: 0,
      submissionsBarPct: 0,
      deltaLabel: 'Черновик',
      successRate: '—',
      verifiedSolutions: 0,
    },
  },
  {
    slug: 'sprint-0-css-battle',
    title: '#0 CSS Battle',
    tabLabel: '#0 CSS Battle',
    tabIcon: 'style',
    completedLabel: 'В архиве',
    tags: ['CSS', 'Animation'],
    active: false,
    published: true,
    archived: true,
    startsAt: new Date('2026-01-10'),
    endsAt: new Date('2026-01-17'),
    brief: {
      quote: 'Архивный тренировочный спринт для первых участников.',
      taskParagraphs: [{ chunks: ['Сверстать промо-экран с микроанимациями.'] }],
      acceptanceTitle: 'Критерии приёмки',
      acceptanceItems: [{ parts: ['Чистая адаптивная верстка.'] }],
      resourceLinks: [],
      sprintPath: '/',
    },
    metrics: {
      submissions: 0,
      submissionsBarPct: 0,
      deltaLabel: 'Архив',
      successRate: '—',
      verifiedSolutions: 0,
    },
  },
] satisfies SeedSprint[]

const ACHIEVEMENTS = [
  {
    slug: 'gaz',
    title: 'Газующий',
    subtitle: 'Не пропустил ни одного спринта',
    icon: 'calendar_month',
  },
  { slug: 'arch', title: 'Архитектор', subtitle: 'Создатель Basalt Arena', icon: 'architecture' },
  { slug: 'first', title: 'Первый', subtitle: 'Выложил решение первым', icon: 'looks_one' },
  { slug: 'ghost', title: 'Невидимка', subtitle: 'Ни разу не участвовал', icon: 'block' },
] as const

const DEMO_USERS: SeedUser[] = [
  {
    email: 'admin@admin.com',
    handle: 'dev_architect',
    role: UserRole.ADMIN,
    bio: 'Архитектор арены. Разработчик.',
    skillsLabel: 'TypeScript, Postgres, Rust',
    realName: 'Команда Basalt',
    stack: ['TypeScript', 'Postgres', 'Rust'],
    telegram: '@dev_architect',
    githubUrl: '/dev_architect',
    points: 90,
    moneyEarned: 0,
    achievements: ['arch'],
  },
  {
    email: 'mentor@basalt-arena.io',
    handle: 'senior_mentor',
    role: UserRole.USER,
    bio: 'Проверяет решения и помогает участникам расти.',
    skillsLabel: 'Senior reviewer',
    realName: 'Старший ментор',
    stack: ['Review', 'Architecture'],
    telegram: '@senior_mentor',
    githubUrl: '/senior_mentor',
    points: 0,
    moneyEarned: 0,
  },
  {
    email: 'lina@example.com',
    handle: 'pixel_runner',
    role: UserRole.USER,
    bio: 'Любит быстрые интерфейсы, аккуратную типографику и CSS-анимации.',
    skillsLabel: 'React, Tailwind, Motion',
    realName: 'Лина Морозова',
    stack: ['React', 'Tailwind', 'Framer Motion'],
    telegram: '@pixel_runner',
    githubUrl: '/pixel-runner',
    points: 1420,
    moneyEarned: 1800,
    achievements: ['first', 'gaz'],
  },
  {
    email: 'timur@example.com',
    handle: 'api_nomad',
    role: UserRole.USER,
    bio: 'Фулстек-разработчик, который приносит порядок в данные и API.',
    skillsLabel: 'Node.js, Prisma, React',
    realName: 'Тимур Галиев',
    stack: ['Node.js', 'Prisma', 'React'],
    telegram: '@api_nomad',
    githubUrl: '/api-nomad',
    points: 1180,
    moneyEarned: 1200,
    achievements: ['gaz'],
  },
  {
    email: 'maya@example.com',
    handle: 'css_alchemist',
    role: UserRole.USER,
    bio: 'Экспериментирует с визуальными эффектами и необычными layout-паттернами.',
    skillsLabel: 'CSS, SVG, Accessibility',
    realName: 'Майя Соколова',
    stack: ['CSS', 'SVG', 'Accessibility'],
    telegram: '@css_alchemist',
    githubUrl: '/css-alchemist',
    points: 760,
    moneyEarned: 600,
  },
  {
    email: 'oleg@example.com',
    handle: 'quiet_builder',
    role: UserRole.USER,
    bio: 'Участник без отправленного решения, чтобы в интерфейсе были видны зрители спринта.',
    skillsLabel: 'JavaScript, QA',
    realName: 'Олег Петров',
    stack: ['JavaScript', 'QA'],
    telegram: '@quiet_builder',
    githubUrl: '/quiet-builder',
    points: 220,
    moneyEarned: 0,
    achievements: ['ghost'],
  },
  {
    email: 'fan@example.com',
    handle: 'hall_fan',
    role: UserRole.USER,
    bio: 'Аккаунт для проверки лайков в Hall of Fame.',
    skillsLabel: 'Community reviewer',
    realName: 'Аня Лайкова',
    stack: ['Community', 'Feedback'],
    telegram: '@hall_fan',
    githubUrl: '/hall-fan',
    points: 430,
    moneyEarned: 0,
  },
]

const SUBMISSIONS = [
  {
    userHandle: 'pixel_runner',
    sprintSlug: 'sprint-2-basalt-arena',
    repoUrl: 'https://github.com/pixel-runner/basalt-arena',
    demoUrl: 'https://pixel-runner-basalt.vercel.app',
    mentorScore: 97,
    status: SubmissionStatus.ACCEPTED,
    mentorComment: 'Отличная работа с визуальной иерархией и адаптивом.',
    createdAt: new Date(Date.now() - 18 * 3600 * 1000),
  },
  {
    userHandle: 'api_nomad',
    sprintSlug: 'sprint-2-basalt-arena',
    repoUrl: 'https://github.com/api-nomad/basalt-arena',
    demoUrl: 'https://api-nomad-arena.vercel.app',
    mentorScore: 84,
    status: SubmissionStatus.REVIEWED,
    mentorComment: 'Хорошая структура, но стоит доработать состояния форм.',
    createdAt: new Date(Date.now() - 12 * 3600 * 1000),
  },
  {
    userHandle: 'css_alchemist',
    sprintSlug: 'sprint-2-basalt-arena',
    repoUrl: 'https://github.com/css-alchemist/basalt-arena',
    demoUrl: 'https://css-alchemist-arena.vercel.app',
    mentorScore: 0,
    status: SubmissionStatus.PENDING,
    mentorComment: null,
    createdAt: new Date(Date.now() - 4 * 3600 * 1000),
  },
  {
    userHandle: 'api_nomad',
    sprintSlug: 'sprint-1-listea',
    repoUrl: 'https://github.com/api-nomad/listea',
    demoUrl: 'https://listea-api-nomad.vercel.app',
    mentorScore: 92,
    status: SubmissionStatus.ACCEPTED,
    mentorComment: 'Стабильное решение с понятной архитектурой.',
    createdAt: new Date('2026-02-20T10:00:00.000Z'),
  },
  {
    userHandle: 'pixel_runner',
    sprintSlug: 'sprint-1-listea',
    repoUrl: 'https://github.com/pixel-runner/listea',
    demoUrl: 'https://listea-pixel-runner.vercel.app',
    mentorScore: 88,
    status: SubmissionStatus.ACCEPTED,
    mentorComment: 'Сильная визуальная часть, есть мелкие вопросы к данным.',
    createdAt: new Date('2026-02-20T12:00:00.000Z'),
  },
  {
    userHandle: 'css_alchemist',
    sprintSlug: 'sprint-1-listea',
    repoUrl: 'https://github.com/css-alchemist/listea',
    demoUrl: 'https://listea-css-alchemist.vercel.app',
    mentorScore: 41,
    status: SubmissionStatus.REJECTED,
    mentorComment: 'Нужно исправить основные сценарии и повторно отправить решение.',
    createdAt: new Date('2026-02-21T09:30:00.000Z'),
  },
] as const

const LIKES = [
  { likedBy: 'hall_fan', author: 'pixel_runner', sprintSlug: 'sprint-2-basalt-arena' },
  { likedBy: 'api_nomad', author: 'pixel_runner', sprintSlug: 'sprint-2-basalt-arena' },
  { likedBy: 'css_alchemist', author: 'pixel_runner', sprintSlug: 'sprint-2-basalt-arena' },
  { likedBy: 'hall_fan', author: 'api_nomad', sprintSlug: 'sprint-2-basalt-arena' },
  { likedBy: 'pixel_runner', author: 'api_nomad', sprintSlug: 'sprint-2-basalt-arena' },
  { likedBy: 'hall_fan', author: 'css_alchemist', sprintSlug: 'sprint-2-basalt-arena' },
  { likedBy: 'pixel_runner', author: 'api_nomad', sprintSlug: 'sprint-1-listea' },
  { likedBy: 'hall_fan', author: 'api_nomad', sprintSlug: 'sprint-1-listea' },
  { likedBy: 'api_nomad', author: 'pixel_runner', sprintSlug: 'sprint-1-listea' },
  { likedBy: 'css_alchemist', author: 'pixel_runner', sprintSlug: 'sprint-1-listea' },
] as const

async function upsertSeedUser(user: SeedUser, passwordHash: string) {
  const data = {
    handle: user.handle,
    passwordHash,
    role: user.role,
    avatarUrl: avatar(user.handle),
    bio: user.bio,
    skillsLabel: user.skillsLabel,
    realName: user.realName,
    stack: user.stack,
    telegram: user.telegram,
    githubUrl: user.githubUrl,
    points: user.points,
    moneyEarned: user.moneyEarned,
  }
  return prisma.user.upsert({
    where: { email: user.email },
    update: data,
    create: {
      email: user.email,
      ...data,
    },
  })
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234'
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'demo1234'

  const [adminHash, demoHash] = await Promise.all([
    argon2.hash(adminPassword, { type: argon2.argon2id }),
    argon2.hash(demoPassword, { type: argon2.argon2id }),
  ])

  const userByHandle = new Map<string, Awaited<ReturnType<typeof upsertSeedUser>>>()
  for (const seedUser of DEMO_USERS) {
    const hash = seedUser.role === UserRole.ADMIN ? adminHash : demoHash
    const user = await upsertSeedUser(seedUser, hash)
    userByHandle.set(user.handle, user)
  }

  for (const sprint of SPRINTS) {
    await prisma.sprint.upsert({
      where: { slug: sprint.slug },
      update: {
        title: sprint.title,
        tabLabel: sprint.tabLabel,
        tabIcon: sprint.tabIcon,
        completedLabel: sprint.completedLabel,
        tags: sprint.tags,
        active: sprint.active,
        published: sprint.published,
        archived: sprint.archived,
        startsAt: sprint.startsAt,
        endsAt: sprint.endsAt,
        brief: sprint.brief,
        metrics: sprint.metrics,
      },
      create: {
        slug: sprint.slug,
        title: sprint.title,
        tabLabel: sprint.tabLabel,
        tabIcon: sprint.tabIcon ?? null,
        completedLabel: sprint.completedLabel,
        tags: [...sprint.tags],
        active: sprint.active,
        published: sprint.published,
        archived: sprint.archived,
        startsAt: sprint.startsAt,
        endsAt: sprint.endsAt,
        brief: sprint.brief,
        metrics: sprint.metrics,
      },
    })
  }

  const sprints = await prisma.sprint.findMany({
    where: { slug: { in: SPRINTS.map((s) => s.slug) } },
  })
  const sprintBySlug = new Map(sprints.map((sprint) => [sprint.slug, sprint]))

  for (const achievement of ACHIEVEMENTS) {
    await prisma.achievement.upsert({
      where: { slug: achievement.slug },
      update: {},
      create: { ...achievement },
    })
  }

  const achievements = await prisma.achievement.findMany()
  const achievementBySlug = new Map(
    achievements.map((achievement) => [achievement.slug, achievement])
  )
  for (const seedUser of DEMO_USERS) {
    const user = userByHandle.get(seedUser.handle)
    if (!user) continue
    for (const achievementSlug of seedUser.achievements ?? []) {
      const achievement = achievementBySlug.get(achievementSlug)
      if (!achievement) continue
      await prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId: user.id, achievementId: achievement.id } },
        update: {},
        create: { userId: user.id, achievementId: achievement.id },
      })
    }
  }

  for (const submission of SUBMISSIONS) {
    const user = userByHandle.get(submission.userHandle)
    const sprint = sprintBySlug.get(submission.sprintSlug)
    if (!user || !sprint) continue
    await prisma.submission.upsert({
      where: { submission_user_sprint_unique: { userId: user.id, sprintId: sprint.id } },
      update: {
        repoUrl: submission.repoUrl,
        demoUrl: submission.demoUrl,
        mentorScore: submission.mentorScore,
        mentorComment: submission.mentorComment,
        status: submission.status,
        createdAt: submission.createdAt,
      },
      create: {
        userId: user.id,
        sprintId: sprint.id,
        repoUrl: submission.repoUrl,
        demoUrl: submission.demoUrl,
        mentorScore: submission.mentorScore,
        mentorComment: submission.mentorComment,
        status: submission.status,
        createdAt: submission.createdAt,
      },
    })
  }

  const allUsers = await prisma.user.findMany({ select: { id: true, role: true } })
  const allSprints = await prisma.sprint.findMany({
    select: { id: true, active: true, published: true, archived: true },
  })
  for (const u of allUsers) {
    for (const sp of allSprints) {
      const canSubmit = sp.active && sp.published && !sp.archived
      await prisma.sprintAccess.upsert({
        where: { sprint_access_user_sprint_unique: { userId: u.id, sprintId: sp.id } },
        create: {
          userId: u.id,
          sprintId: sp.id,
          canSubmit,
          canView: true,
        },
        update: { canSubmit, canView: true },
      })
    }
  }

  const submissions = await prisma.submission.findMany({
    where: { sprint: { slug: { in: SPRINTS.map((s) => s.slug) } } },
    select: {
      id: true,
      userId: true,
      sprint: { select: { slug: true } },
      user: { select: { handle: true } },
    },
  })
  const submissionByAuthorAndSprint = new Map(
    submissions.map((submission) => [
      `${submission.user.handle}:${submission.sprint.slug}`,
      submission,
    ])
  )

  await prisma.solutionLike.createMany({
    data: LIKES.flatMap((like) => {
      const user = userByHandle.get(like.likedBy)
      const submission = submissionByAuthorAndSprint.get(`${like.author}:${like.sprintSlug}`)
      if (!user || !submission || user.id === submission.userId) return []
      return [{ userId: user.id, submissionId: submission.id }]
    }),
    skipDuplicates: true,
  })

  for (const submission of submissions) {
    const likesCount = await prisma.solutionLike.count({ where: { submissionId: submission.id } })
    await prisma.submission.update({ where: { id: submission.id }, data: { likesCount } })
  }

  for (const sprint of sprints) {
    const [total, verified, accepted] = await Promise.all([
      prisma.submission.count({ where: { sprintId: sprint.id } }),
      prisma.submission.count({
        where: {
          sprintId: sprint.id,
          OR: [{ status: SubmissionStatus.ACCEPTED }, { status: SubmissionStatus.REVIEWED }],
        },
      }),
      prisma.submission.count({
        where: { sprintId: sprint.id, status: SubmissionStatus.ACCEPTED },
      }),
    ])
    const likes = await prisma.submission.aggregate({
      where: { sprintId: sprint.id },
      _sum: { likesCount: true },
    })
    await prisma.sprint.update({
      where: { id: sprint.id },
      data: {
        metrics: {
          submissions: total,
          submissionsBarPct:
            total === 0 ? 0 : Math.min(100, Math.round((total / Math.max(total, 50)) * 100)),
          deltaLabel:
            (likes._sum.likesCount ?? 0) > 0 ? `${likes._sum.likesCount} лайков` : 'Демо-данные',
          successRate:
            total === 0 ? '—' : `${((accepted / total) * 100).toFixed(1).replace('.', ',')}%`,
          verifiedSolutions: verified,
        },
      },
    })
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
