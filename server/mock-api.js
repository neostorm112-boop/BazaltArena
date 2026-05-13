import { randomBytes } from 'crypto'
import { readFileSync } from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Router } from 'express'

const __mockDir = path.dirname(fileURLToPath(import.meta.url))

function readArenaSemver() {
  try {
    const raw = readFileSync(path.join(__mockDir, '..', 'package.json'), 'utf8')
    return JSON.parse(raw).version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
}

const ARENA_SEMVER = readArenaSemver()
const DEV_REGISTER_KEY = process.env.BASALT_DEV_REGISTER_KEY || 'basalt-dev-register-key'

const DICEBEAR_IDENTICON = 'https://api.dicebear.com/7.x/identicon/svg'

function dicebearIdenticonUrl(seed) {
  const q = new URLSearchParams({
    seed: String(seed ?? 'user'),
    scale: '62',
    radius: '12',
  })
  return `${DICEBEAR_IDENTICON}?${q.toString()}`
}

const MOCK_USERS = [
  {
    id: 'usr_mock_1',
    email: 'admin@admin.com',
    password: 'admin1234',
    handle: 'dev_architect',
    role: 'Архитектор',
    avatarUrl: dicebearIdenticonUrl('dev_architect'),
  },
  {
    id: 'usr_mock_2',
    email: 'mentor@basalt-arena.io',
    password: 'mentor123',
    handle: 'senior_mentor',
    role: 'Ментор',
    avatarUrl: dicebearIdenticonUrl('senior_mentor'),
  },
]

const sessions = new Map()

const profileEditsByUserId = new Map()
const notificationsUnreadByUserId = new Map()

function notificationsUnreadFor(userId) {
  if (!notificationsUnreadByUserId.has(userId)) {
    notificationsUnreadByUserId.set(userId, 1)
  }
  return notificationsUnreadByUserId.get(userId)
}

function findUserByLogin(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  const lower = s.toLowerCase()
  const byEmail = MOCK_USERS.find((u) => u.email === lower)
  if (byEmail) return byEmail
  const handle = lower.replace(/^@/, '')
  return MOCK_USERS.find((u) => u.handle.toLowerCase() === handle) ?? null
}

function bearerToken(req) {
  const h = req.headers.authorization
  if (!h || !h.startsWith('Bearer ')) return null
  return h.slice(7).trim()
}

function requireAuth(req, res, next) {
  const token = bearerToken(req)
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' })
  }
  req.mockUserId = sessions.get(token).userId
  req.mockToken = token
  next()
}

function requireDevRegisterAccess(req, res, next) {
  const key = String(req.headers['x-dev-register-key'] ?? '').trim()
  if (!key || key !== DEV_REGISTER_KEY) {
    return res.status(403).json({
      ok: false,
      error: 'Registration is developer-only. Provide x-dev-register-key.',
    })
  }
  next()
}

function activeSprintPayload() {
  const endsAt = new Date(Date.now() + 2 * 3600 * 1000 + 45 * 60 * 1000 + 12 * 1000).toISOString()
  return {
    id: 'sprint-2',
    title: '#2 BASALT ARENA (FRONTEND)',
    endsAt,
    systemActive: true,
  }
}

function activeSprintPublicTeaser() {
  const s = activeSprintPayload()
  const sprintNumber = s.title.match(/#(\d+)/)?.[1] ?? null
  return {
    sprintNumber,
    title: s.title,
    systemActive: s.systemActive,
  }
}

function marketingPublicPayload() {
  return {
    fighters: 142,
    totalSprints: 7,
    prizePoolShort: '280K',
    prizeCurrency: '\u20bd',
  }
}

function profilePayload(user) {
  const handle = String(user?.handle ?? 'user')
    .trim()
    .replace(/^@/, '')
  const email = String(user?.email ?? 'user@example.com').trim()
  const telegram = handle ? `@${handle}` : '@user'
  const about = 'Разработчик. Учусь, делаю проекты, участвую в спринтах Basalt Arena.'
  return {
    bio: about,
    skillsLabel: 'Python, Go, Rust',
    contacts: {
      telegram,
      email,
      github: handle ? `/${handle}` : '/user',
    },
    statsCards: [
      {
        key: 'points',
        label: 'Баллы',
        value: '90',
        trendLabel: '+12% за месяц',
        trendVariant: 'malachite',
        icon: 'star',
        iconTint: 'turquoise',
      },
      {
        key: 'rank',
        label: 'Глобальный ранг',
        value: '#3',
        trendLabel: '+2 позиции',
        trendVariant: 'malachite',
        icon: 'leaderboard',
        iconTint: 'turquoise',
      },
      {
        key: 'sprints',
        label: 'Спринтов пройдено',
        value: '1',
        trendLabel: '100% участия',
        trendVariant: 'turquoise',
        icon: 'bolt',
        iconTint: 'turquoise',
      },
      {
        key: 'money',
        label: 'Заработано денег',
        value: '20 000 \u20BD',
        trendLabel: '+20 000 \u20BD',
        trendVariant: 'spring',
        icon: 'payments',
        iconTint: 'spring',
      },
    ],
    achievements: [
      {
        id: 'gaz',
        title: 'Газующий',
        subtitle: 'Не пропустил ни одного спринта',
        icon: 'calendar_month',
        variant: 'earned',
      },
      {
        id: 'arch',
        title: 'Архитектор',
        subtitle: 'Создатель Basalt Arena',
        icon: 'architecture',
        variant: 'earned',
      },
      {
        id: 'first',
        title: 'Первый',
        subtitle: 'Выложил решение первым',
        icon: 'looks_one',
        variant: 'earned',
      },
      {
        id: 'ghost',
        title: 'Невидимка',
        subtitle: 'Ни разу не участвовал',
        icon: 'block',
        variant: 'locked',
      },
    ],
    form: {
      username: handle || 'user',
      email,
      telegram,
      about,
    },
  }
}

function userPayload(user) {
  return {
    id: user.id,
    handle: user.handle,
    role: user.role,
    avatarUrl: user.avatarUrl,
  }
}

function deepMergeProfile(base, edit) {
  if (!edit || typeof edit !== 'object') return base
  return {
    ...base,
    ...edit,
    contacts: {
      ...base.contacts,
      ...(edit.contacts && typeof edit.contacts === 'object' ? edit.contacts : {}),
    },
    form: { ...base.form, ...(edit.form && typeof edit.form === 'object' ? edit.form : {}) },
    statsCards: Array.isArray(edit.statsCards) ? edit.statsCards : base.statsCards,
    achievements: Array.isArray(edit.achievements) ? edit.achievements : base.achievements,
  }
}

function mergedProfileForUser(userId) {
  const user = MOCK_USERS.find((u) => u.id === userId) ?? MOCK_USERS[0]
  const base = profilePayload(user ?? { email: 'user@example.com', handle: 'user' })
  return deepMergeProfile(base, profileEditsByUserId.get(userId))
}

function applyProfilePatch(userId, body) {
  const user = MOCK_USERS.find((u) => u.id === userId)
  if (!user) return null

  const payload = body ?? {}
  const f = payload.form && typeof payload.form === 'object' ? payload.form : {}
  const prev = mergedProfileForUser(user.id)

  const usernameRaw = String(f.username ?? prev.form?.username ?? user.handle)
    .trim()
    .replace(/^@/, '')
  const handle = usernameRaw || user.handle
  user.handle = handle
  user.avatarUrl = dicebearIdenticonUrl(handle)

  const about = f.about != null ? String(f.about) : prev.bio
  const email = String(user.email ?? prev.contacts.email ?? '').trim()
  const telegram = f.telegram != null ? String(f.telegram).trim() : prev.contacts.telegram

  const nextProfile = {
    ...prev,
    bio: about,
    form: {
      ...prev.form,
      username: handle,
      email,
      telegram,
      about,
    },
    contacts: {
      ...prev.contacts,
      email,
      telegram,
      github: `/${handle}`,
    },
  }
  profileEditsByUserId.set(user.id, nextProfile)
  return { user, profile: nextProfile }
}

function createSubmission(payload, submissionId, extra = {}) {
  const { repoUrl, demoUrl } = payload ?? {}
  if (!repoUrl || typeof repoUrl !== 'string') return null
  return {
    ok: true,
    id: `mock-sub-${submissionId}`,
    receivedAt: new Date().toISOString(),
    repoUrl,
    demoUrl: demoUrl && String(demoUrl).trim() ? String(demoUrl) : null,
    ...extra,
  }
}

const HALL_SPRINT_2_SOLUTIONS = [
  {
    rank: 1,
    displayName: 'Nakir',
    handle: 'nakir',
    dateLabel: '14 мая 2026',
    mentorScore: 100,
    likes: 9,
    showCrown: true,
    rankBadge: 'gold',
    avatarSeed: 'nakir',
  },
  {
    rank: 2,
    displayName: 'ilgiz',
    handle: 'ilgiz',
    dateLabel: '13 мая 2026',
    mentorScore: 92,
    likes: 8,
    rankBadge: 'slate',
    avatarSeed: 'ilgiz',
  },
  {
    rank: 3,
    displayName: 'Radik',
    handle: 'radik',
    dateLabel: '13 мая 2026',
    mentorScore: 88,
    likes: 7,
    rankBadge: 'bronze',
    avatarSeed: 'radik',
  },
  {
    rank: 4,
    displayName: 'Масжид',
    handle: 'maszhid',
    dateLabel: '12 мая 2026',
    mentorScore: 84,
    likes: 6,
    rankBadge: 'muted',
    avatarSeed: 'maszhid',
  },
  {
    rank: 5,
    displayName: 'Be yourself.',
    handle: 'beyourself',
    dateLabel: '12 мая 2026',
    mentorScore: 80,
    likes: 6,
    rankBadge: 'muted',
    avatarSeed: 'beyourself',
  },
  {
    rank: 6,
    displayName: 'Yusuf Adilson',
    handle: 'yusuf_adilson',
    dateLabel: '11 мая 2026',
    mentorScore: 76,
    likes: 5,
    rankBadge: 'muted',
    avatarSeed: 'yusuf',
  },
  {
    rank: 7,
    displayName: 'Usman',
    handle: 'usman',
    dateLabel: '11 мая 2026',
    mentorScore: 72,
    likes: 5,
    rankBadge: 'muted',
    avatarSeed: 'usman',
  },
  {
    rank: 8,
    displayName: 'Ибрахим',
    handle: 'ibrahim',
    dateLabel: '10 мая 2026',
    mentorScore: 68,
    likes: 4,
    rankBadge: 'muted',
    avatarSeed: 'ibrahim',
  },
  {
    rank: 9,
    displayName: 'khabbin',
    handle: 'khabbin',
    dateLabel: '10 мая 2026',
    mentorScore: 64,
    likes: 4,
    rankBadge: 'muted',
    avatarSeed: 'khabbin',
  },
  {
    rank: 10,
    displayName: 'Israfil',
    handle: 'israfil',
    dateLabel: '9 мая 2026',
    mentorScore: 60,
    likes: 3,
    rankBadge: 'muted',
    avatarSeed: 'israfil',
  },
]

function withUrls(entries) {
  return entries.map((e) => ({
    ...e,
    avatarUrl: dicebearIdenticonUrl(e.avatarSeed ?? e.handle),
    codeUrl: `https://github.com/mock/${e.handle}`,
    demoUrl: `https://demo.example.com/${e.handle}`,
    profileUrl: `#@${e.handle}`,
    coffeeUrl: e.rank === 1 ? 'https://buymeacoffee.com/mock' : null,
  }))
}

function hallPayload() {
  return {
    page: {
      title: 'Зал славы',
      description:
        'Чествуем архитекторов арены. Просматривайте решения прошлых спринтов, изучайте исходный код победителей и отдавайте дань уважения лучшим участникам.',
      breadcrumbs: [
        { label: 'АРХИВ', muted: true },
        { label: 'СЕЗОН_04', muted: true },
        { label: 'ЗАЛ_СЛАВЫ', muted: false },
      ],
    },
    quote: {
      text: '«Хороший код — сам по себе награда, но золотая рамка тоже не помешает.»',
      attribution: '— Администрация Арены',
    },
    pastWinners: [
      {
        sprintRank: '#1',
        title: 'Listea',
        handle: 'nakir',
        avatarUrl: dicebearIdenticonUrl('nakir'),
      },
      {
        sprintRank: '#0',
        title: '(спринт которого не было)',
        handle: 'abu_js',
        avatarUrl: dicebearIdenticonUrl('abu_js'),
      },
    ],
    loadMoreRemaining: 48,
    sprints: [
      {
        id: '2',
        tabLabel: '#2 Basalt Arena (frontend)',
        tabIcon: 'deployed_code',
        heroTitle: '#2 Basalt Arena (frontend)',
        tags: ['HTML', 'Tailwind CSS'],
        completedLabel: 'Завершён 14 мая',
        briefUrl: '#brief',
        brief: {
          quote:
            '«Перед вами — макет той самой платформы, на которой вы сейчас находитесь. Ваша задача — сверстать его. Да, это рекурсия.»',
          taskParagraphs: [
            {
              chunks: [
                'Реализуйте все три страницы по макету: ',
                { code: 'index.html', after: ' (активный спринт), ' },
                { code: 'hall.html', after: ' (зал славы) и ' },
                { code: 'profile.html', after: ' (профиль). ' },
                'Стек — любой: чистый HTML/CSS, React, Vue, Svelte, Tailwind, Bootstrap, генерация через ИИ — что угодно.',
              ],
            },
          ],
          acceptanceTitle: 'Критерии приёмки',
          acceptanceItems: [
            {
              parts: ['Главное — соответствие макету. Чем точнее, тем выше оценка наставника.'],
            },
            {
              parts: [
                'Весь независимый от бэка JS-функционал должен работать: модалки, таймер, табы, формы и т.д.',
              ],
            },
            {
              parts: [
                'Все запросы к серверу — через мок-API (заглушки). На основе победившего мок-API в следующем спринте будем проектировать настоящий бэкенд.',
              ],
            },
          ],
          resourceLinks: [
            { label: 'Figma-макет', href: '#', icon: 'view_quilt' },
            { label: 'Гайд по мок-API', href: '#', icon: 'code' },
            { label: 'Чат участников', href: '#', icon: 'chat' },
          ],
          sprintPath: '/',
        },
        metrics: {
          submissions: 1429,
          submissionsBarPct: 85,
          deltaLabel: '+12% к прошлому спринту',
          successRate: '42,8%',
          verifiedSolutions: 612,
        },
        solutions: withUrls(HALL_SPRINT_2_SOLUTIONS),
      },
      {
        id: '1',
        tabLabel: '#1 Listea',
        tabIcon: null,
        heroTitle: '#1 Listea',
        tags: ['Vue', 'Pinia'],
        completedLabel: 'Завершён 2 марта',
        briefUrl: '#brief-listra',
        brief: {
          quote: '«Спринт #1 — отдельное задание в экосистеме Vue.»',
          taskParagraphs: [
            {
              chunks: [
                'Подробности — в материалах спринта. Реализуйте требования наставника и приложите ссылки на репозиторий и демо.',
              ],
            },
          ],
          acceptanceTitle: 'Критерии приёмки',
          acceptanceItems: [
            {
              parts: [
                'Соответствие ТЗ, устойчивый UI и работающий фронтенд без обязательной привязки к прод-бэку.',
              ],
            },
          ],
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
        solutions: withUrls(HALL_SPRINT_2_SOLUTIONS.slice(0, 4)),
      },
      {
        id: '0',
        tabLabel: '#0 (спринт которого не было)',
        tabIcon: null,
        heroTitle: '#0 (спринт которого не было)',
        tags: ['—'],
        completedLabel: 'Архив',
        briefUrl: '#brief-zero',
        brief: {
          taskParagraphs: [
            {
              chunks: ['Архивная запись: у этого спринта не было полноценного брифа в системе.'],
            },
          ],
          acceptanceTitle: 'Критерии приёмки',
          acceptanceItems: [{ parts: ['Историческая карточка для зала славы.'] }],
          resourceLinks: [],
          sprintPath: '/',
        },
        metrics: {
          submissions: 0,
          submissionsBarPct: 0,
          deltaLabel: 'Нет сравнения',
          successRate: '—',
          verifiedSolutions: 0,
        },
        solutions: [],
      },
    ],
  }
}

function sprintSummaryFromHallSprint(sprint) {
  const solutions = Array.isArray(sprint?.solutions) ? sprint.solutions : []
  return {
    id: String(sprint?.id ?? ''),
    title: String(sprint?.heroTitle ?? sprint?.tabLabel ?? ''),
    tabLabel: String(sprint?.tabLabel ?? ''),
    tags: Array.isArray(sprint?.tags) ? sprint.tags : [],
    completedLabel: String(sprint?.completedLabel ?? ''),
    metrics: sprint?.metrics ?? null,
    solutionsCount: solutions.length,
    topSolution: solutions[0]
      ? {
          rank: solutions[0].rank,
          handle: solutions[0].handle,
          mentorScore: solutions[0].mentorScore,
          likes: solutions[0].likes,
        }
      : null,
  }
}

function sprintDetailFromHallSprint(sprint) {
  const solutions = Array.isArray(sprint?.solutions) ? sprint.solutions : []
  return {
    id: String(sprint?.id ?? ''),
    title: String(sprint?.heroTitle ?? sprint?.tabLabel ?? ''),
    tabLabel: String(sprint?.tabLabel ?? ''),
    tabIcon: sprint?.tabIcon ?? null,
    tags: Array.isArray(sprint?.tags) ? sprint.tags : [],
    completedLabel: String(sprint?.completedLabel ?? ''),
    brief: sprint?.brief ?? null,
    metrics: sprint?.metrics ?? null,
    solutions,
  }
}

function userAggregatePayload(userId) {
  const user = MOCK_USERS.find((u) => u.id === userId) ?? MOCK_USERS[0]
  const mergedProfile = mergedProfileForUser(user.id)
  const statsCards = Array.isArray(mergedProfile.statsCards) ? mergedProfile.statsCards : []
  const hall = hallPayload()
  const activeHallSprint = Array.isArray(hall.sprints) ? (hall.sprints[0] ?? null) : null

  const stats = {
    points: Number(statsCards.find((c) => c?.key === 'points')?.value ?? 0) || 0,
    globalRank: String(statsCards.find((c) => c?.key === 'rank')?.value ?? '#0'),
    sprintsCompleted: Number(statsCards.find((c) => c?.key === 'sprints')?.value ?? 0) || 0,
    moneyEarned: String(statsCards.find((c) => c?.key === 'money')?.value ?? '0'),
    cards: statsCards,
  }

  return {
    id: user.id,
    email: user.email,
    handle: user.handle,
    role: user.role,
    avatarUrl: user.avatarUrl,
    profile: {
      bio: mergedProfile.bio,
      skillsLabel: mergedProfile.skillsLabel,
      contacts: mergedProfile.contacts,
      form: mergedProfile.form,
    },
    stats,
    achievements: Array.isArray(mergedProfile.achievements) ? mergedProfile.achievements : [],
    notifications: {
      unreadCount: notificationsUnreadFor(user.id),
    },
    sprintContext: {
      activeSprint: activeSprintPayload(),
      activeHallSprint: activeHallSprint ? sprintSummaryFromHallSprint(activeHallSprint) : null,
    },
  }
}

export function createMockApiRouter() {
  const router = Router()
  let submissionSeq = 0

  router.get('/health', (_req, res) => {
    res.json({ ok: true })
  })

  router.post('/auth/login', (req, res) => {
    const { email, password } = req.body ?? {}
    const user = findUserByLogin(email)
    if (!user || user.password !== String(password ?? '')) {
      return res.status(401).json({ ok: false, error: 'Неверный email или пароль' })
    }
    const token = randomBytes(24).toString('hex')
    sessions.set(token, { userId: user.id })
    notificationsUnreadByUserId.set(user.id, 1)
    res.json({
      accessToken: token,
      tokenType: 'Bearer',
      user: userPayload(user),
    })
  })

  router.post('/auth/register', requireDevRegisterAccess, (req, res) => {
    const { email, password, handle: handleRaw } = req.body ?? {}
    const e = String(email ?? '')
      .trim()
      .toLowerCase()
    const p = String(password ?? '')
    const h = String(handleRaw ?? '')
      .trim()
      .replace(/^@/, '')

    if (!e || !p || !h) {
      return res.status(400).json({ ok: false, error: 'Укажите email, пароль и ник' })
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
      return res.status(400).json({ ok: false, error: 'Некорректный email' })
    }
    if (p.length < 6) {
      return res.status(400).json({ ok: false, error: 'Пароль не короче 6 символов' })
    }
    if (h.length < 2 || !/^[a-zA-Z0-9_]+$/.test(h)) {
      return res.status(400).json({ ok: false, error: 'Ник: латиница, цифры и _, от 2 символов' })
    }
    if (MOCK_USERS.some((u) => u.email === e)) {
      return res.status(409).json({ ok: false, error: 'Этот email уже занят' })
    }
    const hLower = h.toLowerCase()
    if (MOCK_USERS.some((u) => u.handle.toLowerCase() === hLower)) {
      return res.status(409).json({ ok: false, error: 'Этот ник уже занят' })
    }

    const user = {
      id: `usr_reg_${randomBytes(8).toString('hex')}`,
      email: e,
      password: p,
      handle: h,
      role: 'Участник',
      avatarUrl: dicebearIdenticonUrl(h),
    }
    MOCK_USERS.push(user)

    const token = randomBytes(24).toString('hex')
    sessions.set(token, { userId: user.id })
    notificationsUnreadByUserId.set(user.id, 1)
    res.status(201).json({
      accessToken: token,
      tokenType: 'Bearer',
      user: userPayload(user),
    })
  })

  router.post('/auth/logout', requireAuth, (req, res) => {
    sessions.delete(req.mockToken)
    res.json({ ok: true })
  })

  router.get('/v2/me', requireAuth, (req, res) => {
    const user = MOCK_USERS.find((u) => u.id === req.mockUserId)
    if (!user) return res.status(401).json({ ok: false, error: 'Unauthorized' })
    res.json({
      user: userAggregatePayload(user.id),
    })
  })

  router.get('/v2/sprints', requireAuth, (_req, res) => {
    const hall = hallPayload()
    const sprints = Array.isArray(hall.sprints) ? hall.sprints.map(sprintSummaryFromHallSprint) : []
    res.json({
      page: hall.page,
      quote: hall.quote,
      pastWinners: hall.pastWinners,
      loadMoreRemaining: hall.loadMoreRemaining ?? 0,
      sprints,
    })
  })

  router.get('/v2/sprints/:id', requireAuth, (req, res) => {
    const sprintId = String(req.params.id ?? '')
    const hall = hallPayload()
    const sprint = (Array.isArray(hall.sprints) ? hall.sprints : []).find(
      (s) => String(s?.id) === sprintId
    )
    if (!sprint) {
      return res.status(404).json({ ok: false, error: 'Sprint not found' })
    }
    res.json({
      sprint: sprintDetailFromHallSprint(sprint),
    })
  })

  router.get('/v2/sprints/:id/solutions', requireAuth, (req, res) => {
    const sprintId = String(req.params.id ?? '')
    const hall = hallPayload()
    const sprint = (Array.isArray(hall.sprints) ? hall.sprints : []).find(
      (s) => String(s?.id) === sprintId
    )
    if (!sprint) {
      return res.status(404).json({ ok: false, error: 'Sprint not found' })
    }
    const solutions = Array.isArray(sprint.solutions) ? sprint.solutions : []
    res.json({
      sprintId,
      total: solutions.length,
      solutions,
    })
  })

  router.patch('/v2/me/profile', requireAuth, (req, res) => {
    const next = applyProfilePatch(req.mockUserId, req.body)
    if (!next) return res.status(401).json({ ok: false, error: 'Unauthorized' })
    res.json({
      ok: true,
      user: userAggregatePayload(next.user.id),
    })
  })

  router.post('/v2/me/notifications/read', requireAuth, (req, res) => {
    notificationsUnreadByUserId.set(req.mockUserId, 0)
    res.json({ ok: true, unreadCount: 0 })
  })

  router.get('/v2/meta', (_req, res) => {
    const display = new Date().toUTCString().match(/\d{2}:\d{2}/)?.[0] ?? '00:00'
    res.json({
      app: {
        build: `v${ARENA_SEMVER}-mock`,
        copyrightYear: new Date().getUTCFullYear(),
      },
      server: {
        timeUtcDisplay: display,
      },
      sprintTeaser: activeSprintPublicTeaser(),
      marketing: marketingPublicPayload(),
    })
  })

  router.post('/v2/submissions', requireAuth, (req, res) => {
    submissionSeq += 1
    const submission = createSubmission(req.body, submissionSeq)
    if (!submission) {
      return res.status(400).json({ ok: false, error: 'repoUrl required' })
    }
    res.json(submission)
  })

  router.post('/v2/sprints/:id/submissions', requireAuth, (req, res) => {
    const sprintId = String(req.params.id ?? '')
    const hall = hallPayload()
    const sprintExists = (Array.isArray(hall.sprints) ? hall.sprints : []).some(
      (s) => String(s?.id) === sprintId
    )
    if (!sprintExists) {
      return res.status(404).json({ ok: false, error: 'Sprint not found' })
    }

    submissionSeq += 1
    const submission = createSubmission(req.body, submissionSeq, { sprintId })
    if (!submission) {
      return res.status(400).json({ ok: false, error: 'repoUrl required' })
    }
    res.json(submission)
  })

  return router
}
