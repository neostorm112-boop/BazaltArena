import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { patchProfile } from '../api/basaltApi.js'
import { useAuth } from '../auth/useAuth.js'
import { AppFooter } from '../components/layout/AppFooter.jsx'
import { AppHeader } from '../components/layout/AppHeader.jsx'
import { MaterialIcon } from '../components/ui/MaterialIcon.jsx'
import { ProfileSprintHistory } from './ProfileSprintHistory.jsx'

function dicebearAvatar(seed) {
  const q = new URLSearchParams({
    seed: String(seed),
    scale: '62',
    radius: '12',
  })
  return `https://api.dicebear.com/7.x/identicon/svg?${q.toString()}`
}

const FALLBACK_PROFILE = {
  bio: 'Разработчик. Учусь, делаю проекты, участвую в спринтах Basalt Arena.',
  skillsLabel: 'Python, Go, Rust',
  contacts: {
    telegram: '@dev_architect',
    email: 'admin@admin.com',
    github: '/dev_architect',
  },
  statsCards: [
    {
      key: 'points',
      label: 'Баллы',
      value: '90',
      trendLabel: '+12% за месяц',
      trendVariant: 'malachite',
      trendIcon: 'trending_up',
      icon: 'star',
      iconTint: 'turquoise',
    },
    {
      key: 'rank',
      label: 'Глобальный ранг',
      value: '#3',
      trendLabel: '+2 позиции',
      trendVariant: 'malachite',
      trendIcon: 'trending_flat',
      icon: 'leaderboard',
      iconTint: 'turquoise',
    },
    {
      key: 'sprints',
      label: 'Спринтов пройдено',
      value: '1',
      trendLabel: '100% участия',
      trendVariant: 'turquoise',
      trendIcon: 'trending_flat',
      icon: 'bolt',
      iconTint: 'turquoise',
    },
    {
      key: 'money',
      label: 'Заработано денег',
      value: '20 000 \u20BD',
      trendLabel: '+20 000 \u20BD',
      trendVariant: 'spring',
      trendIcon: 'trending_up',
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
    username: 'dev_architect',
    email: 'admin@admin.com',
    telegram: '@dev_architect',
    about: 'Разработчик. Учусь, делаю проекты, участвую в спринтах Basalt Arena.',
  },
}

const SIDEBAR_NAV = [
  { key: 'overview', label: 'Обзор', icon: 'person', sectionId: 'profile-hero' },
  {
    key: 'badges',
    label: 'Бейджи и достижения',
    icon: 'workspace_premium',
    sectionId: 'profile-achievements',
  },
  { key: 'stats', label: 'Статистика', icon: 'query_stats', sectionId: 'profile-stats' },
  {
    key: 'history',
    label: 'История спринтов',
    icon: 'history',
    sectionId: 'profile-sprint-history',
  },
  { key: 'settings', label: 'Настройки', icon: 'settings', sectionId: 'profile-settings' },
]

const SECTION_TO_NAV = {
  'profile-hero': 'overview',
  'profile-stats': 'stats',
  'profile-achievements': 'badges',
  'profile-sprint-history': 'history',
  'profile-settings': 'settings',
}

function trendPillClass(variant) {
  switch (variant) {
    case 'malachite':
      return 'border border-[rgba(11,218,84,0.2)] bg-[rgba(11,218,84,0.1)] text-[#0BDA54]'
    case 'turquoise':
      return 'border border-turquoise/20 bg-turquoise/10 text-turquoise'
    case 'spring':
      return 'border border-spring/20 bg-spring/10 text-spring'
    case 'rose':
      return 'border border-red-500/25 bg-red-500/10 text-red-300'
    case 'slate':
      return 'border border-slate-arena/35 bg-slate-arena/10 text-gull'
    default:
      return 'border border-turquoise/20 bg-turquoise/10 text-turquoise'
  }
}

function bigIconTintClass(tint) {
  return tint === 'spring'
    ? 'text-spring group-hover:opacity-35 group-hover:text-[#4ade80]'
    : 'text-turquoise group-hover:opacity-35 group-hover:text-half-baked'
}

function StatMetricCard({ card }) {
  const trendVariant = card.trendVariant ?? 'turquoise'
  const iconTint = card.iconTint ?? 'turquoise'
  const cardKey = String(card.key ?? '')
  const hoverFrameClass = 'hover:border-fiord'

  return (
    <div
      className={[
        'group relative isolate overflow-hidden rounded-xl border border-plantation bg-timber p-6 transition-colors duration-150 max-[360px]:p-4',
        hoverFrameClass,
      ].join(' ')}
    >
      <div
        className={`pointer-events-none absolute right-px top-px flex items-start justify-end p-2 opacity-10 transition-[opacity,color] duration-300 ${bigIconTintClass(iconTint)}`}
        aria-hidden
      >
        <MaterialIcon name={card.icon} size={72} opticalSize={24} className="leading-none" />
      </div>
      <div className="relative z-[1] flex min-h-[99px] flex-col max-[360px]:min-h-[84px]">
        <p className="pb-1 text-xs font-bold uppercase leading-4 tracking-[1.2px] text-gull max-[360px]:text-[10px]">
          {card.label}
        </p>
        <p className="pb-2 text-[36px] font-bold leading-[45px] text-white max-[360px]:text-[30px] max-[360px]:leading-9">
          {card.value}
        </p>
        <div
          className={`inline-flex w-max max-w-full items-center gap-1.5 rounded px-2 py-0.5 text-xs font-bold leading-4 ${trendPillClass(trendVariant)}`}
        >
          <MaterialIcon
            name={card.trendIcon ?? 'trending_up'}
            size={14}
            opticalSize={14}
            className="leading-none"
          />
          <span>{card.trendLabel}</span>
        </div>
      </div>
    </div>
  )
}

function AchievementTile({ achievement }) {
  const locked = achievement.variant === 'locked'
  const iconName = achievement.icon === 'looks_one' ? 'filter_1' : achievement.icon
  return (
    <div
      className={[
        'group relative isolate flex flex-col items-center rounded-xl p-6 transition-[border-color,background-color,box-shadow] duration-300 max-[360px]:p-4',
        locked
          ? 'border border-dashed border-red-500/25 bg-[rgba(239,68,68,0.04)] hover:border-red-400/40'
          : 'border border-plantation bg-timber hover:border-fiord',
      ].join(' ')}
    >
      <div className="relative z-[1] mb-4 flex flex-col items-center">
        <div
          className={[
            'relative flex size-16 items-center justify-center rounded-full bg-aztec max-[360px]:size-14',
            locked ? 'border border-red-500/30' : 'border border-plantation',
          ].join(' ')}
        >
          <MaterialIcon
            name={iconName}
            size={30}
            opticalSize={24}
            className={[
              'transition-transform duration-300 group-hover:scale-110 max-[360px]:[font-size:26px]',
              locked ? 'text-[#F87171]' : 'text-turquoise',
            ].join(' ')}
          />
        </div>
      </div>
      <div className="relative z-[2] flex min-w-[110px] max-w-[180px] flex-col items-center gap-1 text-center">
        <p
          className={['text-sm font-bold leading-5', locked ? 'text-[#FCA5A5]' : 'text-white'].join(
            ' '
          )}
        >
          {achievement.title}
        </p>
        <p className="font-mono text-[10px] font-normal leading-[15px] text-slate-arena">
          {achievement.subtitle}
        </p>
      </div>
    </div>
  )
}

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile: profileRaw, refreshSession, logout, sprintHistory } = useAuth()
  const profile = useMemo(() => {
    const p = profileRaw && typeof profileRaw === 'object' ? profileRaw : {}
    return {
      ...FALLBACK_PROFILE,
      ...p,
      contacts: {
        ...FALLBACK_PROFILE.contacts,
        ...(p.contacts && typeof p.contacts === 'object' ? p.contacts : {}),
      },
      form: {
        ...FALLBACK_PROFILE.form,
        ...(p.form && typeof p.form === 'object' ? p.form : {}),
      },
      statsCards: Array.isArray(p.statsCards) ? p.statsCards : FALLBACK_PROFILE.statsCards,
      achievements: Array.isArray(p.achievements) ? p.achievements : FALLBACK_PROFILE.achievements,
    }
  }, [profileRaw])

  const [activeNav, setActiveNav] = useState('overview')
  const [form, setForm] = useState(() => ({
    username: FALLBACK_PROFILE.form.username,
    telegram: FALLBACK_PROFILE.form.telegram,
    about: FALLBACK_PROFILE.form.about,
  }))
  const [saveState, setSaveState] = useState('idle')
  const scrollSuppressRef = useRef(0)

  useEffect(() => {
    const id = window.setTimeout(() => {
      const f = profileRaw?.form && typeof profileRaw.form === 'object' ? profileRaw.form : {}
      setForm({
        username: f.username ?? FALLBACK_PROFILE.form.username,
        telegram: f.telegram ?? FALLBACK_PROFILE.form.telegram,
        about: f.about ?? FALLBACK_PROFILE.form.about,
      })
    }, 0)
    return () => window.clearTimeout(id)
  }, [profileRaw])

  useEffect(() => {
    const ids = Object.keys(SECTION_TO_NAV)
    const obs = new IntersectionObserver(
      (entries) => {
        if (Date.now() < scrollSuppressRef.current) return
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        const id = visible[0]?.target?.id
        if (id && SECTION_TO_NAV[id]) {
          setActiveNav(SECTION_TO_NAV[id])
        }
      },
      { root: null, rootMargin: '-96px 0px -48% 0px', threshold: [0, 0.05, 0.1] }
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [])

  const avatarSrc = user?.avatarUrl?.trim() || dicebearAvatar(user?.handle ?? user?.id ?? 'user')

  const scrollToSection = useCallback((navKey, sectionId) => {
    scrollSuppressRef.current = Date.now() + 800
    setActiveNav(navKey)
    const el = document.getElementById(sectionId)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const displayHandle = `@${String(user.handle ?? '').replace(/^@/, '')}`
  const registeredEmail =
    String(profile.form?.email ?? profile.contacts?.email ?? '').trim() ||
    FALLBACK_PROFILE.form.email

  if (!user) return null

  return (
    <div className="flex min-h-screen flex-col bg-aztec">
      <AppHeader />
      <main className="flex-1 pt-[73px]">
        <div className="mx-auto max-w-[1400px] px-6 pb-10 pt-10 max-[360px]:px-3 max-[360px]:pb-6 max-[360px]:pt-6 md:px-10">
          <div className="flex flex-col gap-8 max-[360px]:gap-6 lg:flex-row lg:items-start lg:gap-8">
            <aside className="flex w-full shrink-0 flex-col gap-6 lg:w-[306px]">
              <nav className="flex flex-col gap-2 max-[360px]:gap-1.5">
                {SIDEBAR_NAV.map((item) => {
                  const active = activeNav === item.key
                  return (
                    <button
                      key={item.key}
                      type="button"
                      disabled={Boolean(item.disabled)}
                      onClick={() => {
                        if (item.disabled || !item.sectionId) return
                        scrollToSection(item.key, item.sectionId)
                      }}
                      className={[
                        'flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium leading-5 transition max-[360px]:gap-2 max-[360px]:px-3 max-[360px]:py-2.5 max-[360px]:text-xs',
                        active
                          ? 'border border-turquoise/20 bg-turquoise/10 text-turquoise'
                          : item.disabled
                            ? 'cursor-default text-fiord opacity-40'
                            : 'text-fiord opacity-40 hover:opacity-70',
                      ].join(' ')}
                    >
                      <MaterialIcon
                        name={item.icon}
                        size={24}
                        opticalSize={24}
                        className={active ? 'text-turquoise' : 'text-fiord'}
                      />
                      {item.label}
                    </button>
                  )
                })}
              </nav>

              <div className="flex flex-col gap-4 rounded-xl border border-plantation bg-timber/20 p-5 max-[360px]:gap-3 max-[360px]:p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold uppercase leading-4 tracking-[1.2px] text-slate-arena">
                    Контакты
                  </p>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-arena transition-colors hover:text-white"
                    aria-label="Изменить контакты"
                  >
                    <MaterialIcon name="edit" size={14} opticalSize={14} />
                  </button>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="group flex items-center justify-between gap-2 rounded border border-transparent px-2 py-2 transition-[border-color,background-color] duration-200 hover:border-white/15 hover:bg-white/[0.045]">
                    <span className="inline-flex items-center gap-2 text-sm text-gull transition-colors group-hover:text-white max-[360px]:text-xs">
                      <MaterialIcon
                        name="send"
                        size={18}
                        opticalSize={18}
                        className="text-gull transition-colors group-hover:text-white"
                      />
                      Telegram
                    </span>
                    <span className="text-sm text-turquoise max-[360px]:text-xs">
                      {profile.contacts.telegram}
                    </span>
                  </div>
                  <div className="group flex items-center justify-between gap-2 rounded border border-transparent px-2 py-2 transition-[border-color,background-color] duration-200 hover:border-white/15 hover:bg-white/[0.045]">
                    <span className="inline-flex items-center gap-2 text-sm text-gull transition-colors group-hover:text-white max-[360px]:text-xs">
                      <MaterialIcon
                        name="mail"
                        size={18}
                        opticalSize={18}
                        className="text-gull transition-colors group-hover:text-white"
                      />
                      Email
                    </span>
                    <span className="truncate text-sm text-turquoise max-[360px]:text-xs">
                      {profile.contacts.email}
                    </span>
                  </div>
                  <div className="group flex items-center justify-between gap-2 rounded border border-transparent px-2 py-2 transition-[border-color,background-color] duration-200 hover:border-white/15 hover:bg-white/[0.045]">
                    <span className="inline-flex items-center gap-2 text-sm text-gull transition-colors group-hover:text-white max-[360px]:text-xs">
                      <MaterialIcon
                        name="code"
                        size={18}
                        opticalSize={18}
                        className="text-gull transition-colors group-hover:text-white"
                      />
                      GitHub
                    </span>
                    <span className="text-sm text-turquoise max-[360px]:text-xs">
                      {profile.contacts.github}
                    </span>
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex min-w-0 flex-1 flex-col gap-8">
              <section
                id="profile-hero"
                className="scroll-mt-[88px] relative isolate overflow-hidden rounded-xl border border-plantation bg-timber p-8 max-[360px]:p-4"
              >
                <div className="relative z-[1] flex flex-col items-center gap-8 max-[360px]:gap-4 md:flex-row md:items-center">
                  <div className="relative flex size-[132px] shrink-0 items-center justify-center rounded-2xl border border-plantation bg-aztec transition-colors duration-150 hover:border-fiord max-[360px]:size-24">
                    <img
                      src={avatarSrc}
                      alt=""
                      className="size-32 object-contain max-[360px]:size-20"
                      decoding="async"
                      draggable={false}
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col items-center gap-1 md:items-start">
                    <h1 className="text-center text-[30px] font-bold leading-9 tracking-[-0.75px] text-white max-[360px]:text-2xl max-[360px]:leading-8 md:text-left">
                      {displayHandle}
                    </h1>
                    <p className="max-w-[512px] text-center font-mono text-sm font-normal leading-5 text-gull max-[360px]:text-xs md:text-left">
                      {profile.bio}
                    </p>
                    <div className="flex w-full flex-wrap justify-center gap-2 pt-4 md:justify-start">
                      <div className="inline-flex items-center gap-2 rounded border border-plantation bg-aztec/80 px-3 py-1.5">
                        <MaterialIcon
                          name="code"
                          size={14}
                          opticalSize={14}
                          className="text-[#4ADE80]"
                        />
                        <span className="text-xs font-medium leading-4 text-mystic">
                          {profile.skillsLabel}
                        </span>
                        <MaterialIcon
                          name="edit"
                          size={12}
                          opticalSize={12}
                          className="text-slate-arena"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section
                id="profile-stats"
                className="scroll-mt-[88px] grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
              >
                {profile.statsCards.map((c) => (
                  <StatMetricCard key={String(c.key)} card={c} />
                ))}
              </section>

              <section
                id="profile-achievements"
                className="scroll-mt-[88px] flex flex-col gap-6 max-[360px]:gap-4"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:pb-2">
                  <h2 className="inline-flex items-center gap-2 text-lg font-bold leading-7 text-white">
                    <MaterialIcon
                      name="military_tech"
                      size={24}
                      opticalSize={24}
                      className="text-turquoise"
                    />
                    Галерея достижений
                  </h2>
                  <Link
                    to="/hall"
                    className="group inline-flex items-center gap-1 text-xs font-bold uppercase leading-4 tracking-[0.6px] text-gull transition hover:text-turquoise"
                  >
                    ВСЕ ДОСТИЖЕНИЯ
                    <MaterialIcon
                      name="arrow_forward"
                      size={16}
                      opticalSize={16}
                      className="text-gull transition-colors group-hover:text-turquoise"
                    />
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4 max-[360px]:grid-cols-1 max-[360px]:gap-3 min-[760px]:grid-cols-4">
                  {profile.achievements.map((a) => (
                    <AchievementTile key={String(a.id)} achievement={a} />
                  ))}
                </div>
              </section>

              <section
                id="profile-sprint-history"
                className="scroll-mt-[88px] flex flex-col gap-6 max-[360px]:gap-4"
              >
                <h2 className="inline-flex items-center gap-2 text-lg font-bold leading-7 text-white">
                  <MaterialIcon
                    name="history"
                    size={24}
                    opticalSize={24}
                    className="text-turquoise"
                  />
                  История спринтов
                </h2>
                <ProfileSprintHistory items={sprintHistory?.items} />
              </section>

              <section
                id="profile-settings"
                className="scroll-mt-[88px] flex flex-col gap-6 rounded-xl border border-plantation bg-timber/10 px-8 pb-12 pt-8 max-[360px]:gap-4 max-[360px]:px-4 max-[360px]:pb-6 max-[360px]:pt-5"
              >
                <div className="flex items-center gap-3 pb-2">
                  <MaterialIcon
                    name="manage_accounts"
                    size={24}
                    opticalSize={24}
                    className="text-turquoise"
                  />
                  <h2 className="text-lg font-bold leading-7 text-white">Настройки профиля</h2>
                </div>

                <form
                  className="flex flex-col gap-6"
                  onSubmit={async (e) => {
                    e.preventDefault()
                    setSaveState('saving')
                    try {
                      await patchProfile({
                        form: {
                          username: form.username,
                          telegram: form.telegram,
                          about: form.about,
                        },
                      })
                      await refreshSession()
                      setSaveState('saved')
                      window.setTimeout(() => setSaveState('idle'), 2800)
                    } catch (err) {
                      console.warn('[profile] save', err)
                      setSaveState('error')
                    }
                  }}
                >
                  <div className="grid grid-cols-1 gap-6 max-[360px]:gap-4 xl:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase leading-4 tracking-[1.2px] text-gull">
                        Имя пользователя
                      </label>
                      <div className="relative isolate">
                        <MaterialIcon
                          name="person"
                          size={18}
                          opticalSize={18}
                          className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-slate-arena"
                        />
                        <input
                          value={form.username}
                          onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                          className="box-border h-[46px] w-full rounded-lg border border-plantation bg-aztec py-2.5 pl-10 pr-4 text-base font-normal leading-6 text-white outline-none placeholder:text-gull/50 focus:border-turquoise/40"
                          autoComplete="username"
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase leading-4 tracking-[1.2px] text-gull">
                        Электронная почта
                      </label>
                      <div className="relative isolate">
                        <MaterialIcon
                          name="mail"
                          size={18}
                          opticalSize={18}
                          className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-slate-arena"
                        />
                        <input
                          id="profile-settings-email"
                          type="email"
                          readOnly
                          tabIndex={-1}
                          value={registeredEmail}
                          aria-readonly="true"
                          aria-describedby="profile-settings-email-hint"
                          className="box-border h-[46px] w-full cursor-default rounded-lg border border-plantation bg-aztec/70 py-2.5 pl-10 pr-4 text-base font-normal leading-6 text-gull outline-none focus:border-plantation focus:ring-0"
                          autoComplete="off"
                        />
                      </div>
                      <p
                        className="font-mono text-[11px] font-normal leading-[17px] text-slate-arena"
                        id="profile-settings-email-hint"
                      >
                        Почту нельзя изменить самостоятельно. Для смены адреса обратитесь к
                        администратору.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 max-[360px]:gap-4 xl:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-bold uppercase leading-4 tracking-[1.2px] text-gull">
                        Telegram
                      </label>
                      <div className="relative isolate">
                        <MaterialIcon
                          name="send"
                          size={18}
                          opticalSize={18}
                          className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-slate-arena"
                        />
                        <input
                          value={form.telegram}
                          onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))}
                          className="box-border h-[46px] w-full rounded-lg border border-plantation bg-aztec py-2.5 pl-10 pr-4 text-base font-normal leading-6 text-white outline-none placeholder:text-gull/50 focus:border-turquoise/40"
                        />
                      </div>
                    </div>
                    <div className="hidden xl:block" aria-hidden />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-bold uppercase leading-4 tracking-[1.2px] text-gull">
                      О себе
                    </label>
                    <textarea
                      value={form.about}
                      onChange={(e) => setForm((f) => ({ ...f, about: e.target.value }))}
                      rows={4}
                      className="min-h-[94px] w-full resize-y rounded-lg border border-plantation bg-aztec px-4 py-3 font-mono text-sm font-normal leading-[23px] text-white outline-none placeholder:text-gull/50 focus:border-turquoise/40"
                    />
                  </div>

                  <div className="flex flex-col gap-2 border-t border-plantation pt-4">
                    <div className="flex min-h-6 w-full flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-end">
                      {saveState === 'saved' ? (
                        <span className="font-mono text-xs text-spring md:mr-auto">
                          Изменения сохранены
                        </span>
                      ) : null}
                      {saveState === 'error' ? (
                        <span className="font-mono text-xs text-[#FCA5A5] md:mr-auto">
                          Не удалось сохранить
                        </span>
                      ) : null}
                      <div className="flex w-full min-w-0 flex-row items-stretch gap-3 md:w-auto md:justify-end">
                        <button
                          type="button"
                          className="h-12 min-w-0 flex-1 basis-0 rounded-lg border border-plantation px-4 text-sm font-bold leading-5 text-gull transition hover:bg-white/5 md:w-auto md:flex-none md:basis-auto md:min-w-[107px] md:px-6"
                          onClick={() =>
                            setForm({
                              username: profile.form.username,
                              telegram: profile.form.telegram,
                              about: profile.form.about,
                            })
                          }
                        >
                          Отмена
                        </button>
                        <button
                          type="submit"
                          disabled={saveState === 'saving'}
                          className="inline-flex h-11 min-w-0 flex-[1.15] basis-0 items-center justify-center gap-2 rounded-lg bg-turquoise px-4 text-sm font-semibold leading-5 text-white transition-colors duration-150 hover:bg-[#6d4ef0] disabled:cursor-not-allowed disabled:opacity-60 md:w-auto md:flex-none md:basis-auto md:px-8"
                        >
                          <MaterialIcon
                            name="save"
                            size={16}
                            opticalSize={16}
                            className="shrink-0 text-white"
                          />
                          {saveState === 'saving' ? 'Сохранение…' : 'Сохранить'}
                        </button>
                      </div>
                    </div>
                  </div>
                </form>

                <div className="border-t border-plantation pt-6 xl:hidden">
                  <button
                    type="button"
                    onClick={async () => {
                      await logout()
                      navigate('/login', { replace: true })
                    }}
                    className="font-mono text-xs font-semibold uppercase tracking-[1px] text-gull transition hover:text-catskill"
                  >
                    Выйти из аккаунта
                  </button>
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
      <AppFooter />
    </div>
  )
}
