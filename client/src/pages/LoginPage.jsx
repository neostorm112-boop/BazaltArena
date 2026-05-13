import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getMeta } from '../api/basaltApi.js'
import { useAuth } from '../auth/useAuth.js'
import { MaterialIcon } from '../components/ui/MaterialIcon.jsx'

function isLikelyNetworkFailure(err) {
  if (!err || typeof err !== 'object') return false
  if (err instanceof TypeError) return true
  if (!(err instanceof Error)) return false
  const m = err.message || ''
  return (
    m === 'Failed to fetch' ||
    m === 'Load failed' ||
    m === 'NetworkError when attempting to fetch resource.'
  )
}

function safeRedirectPath(state) {
  const from = state && typeof state === 'object' && 'from' in state ? state.from : null
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) {
    return '/'
  }
  const pathOnly = from.split(/[?#]/)[0]
  if (pathOnly === '/login') {
    return '/'
  }
  return from
}

const FEATURES = [
  {
    icon: 'bolt',
    title: 'Реальные задачи',
    body: 'Никаких leetcode-головоломок. Только то, что встретишь в проде.',
  },
  {
    icon: 'groups',
    title: 'Открытое сообщество',
    body: 'Решения публикуются — учись у тех, кто впереди тебя.',
  },
  {
    icon: 'monitor',
    title: 'Решение в проде',
    body: 'Один победитель спринта — его код уезжает в прод, а он получает деньги.',
  },
]

function AuthFeedback({ info, err, errRef }) {
  return (
    <>
      {info ? (
        <p className="font-mono text-xs leading-relaxed text-turquoise/90" role="status">
          {info}
        </p>
      ) : null}
      {err ? (
        <div ref={errRef} tabIndex={-1} className="rounded-md outline-none ring-0" role="alert">
          <p className="font-mono text-xs leading-relaxed text-red-400">{err}</p>
        </div>
      ) : null}
    </>
  )
}

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, user, ready } = useAuth()
  const errRef = useRef(null)
  const [loginOrEmail, setLoginOrEmail] = useState('admin@admin.com')
  const [password, setPassword] = useState('admin1234')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [err, setErr] = useState(null)
  const [info, setInfo] = useState(null)
  const [pending, setPending] = useState(false)
  const [meta, setMeta] = useState({ sprintTeaser: null, marketing: null })

  const dismissErr = () => {
    setErr(null)
    setInfo(null)
  }

  useEffect(() => {
    let cancelled = false
    getMeta()
      .then((m) => {
        if (!cancelled) {
          setMeta({
            sprintTeaser: m.sprintTeaser ?? null,
            marketing: m.marketing ?? null,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setMeta({ sprintTeaser: null, marketing: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useLayoutEffect(() => {
    if (err) errRef.current?.focus?.()
  }, [err])

  const sprintBadgeLabel =
    meta.sprintTeaser?.sprintNumber != null
      ? `Спринт #${meta.sprintTeaser.sprintNumber} в эфире`
      : 'Спринт в эфире'

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-aztec font-sans text-sm text-half-baked">
        Загрузка…
      </div>
    )
  }

  if (user) {
    return <Navigate to={safeRedirectPath(location.state)} replace />
  }

  async function onSubmit(e) {
    e.preventDefault()
    dismissErr()
    setPending(true)
    try {
      await login(loginOrEmail.trim(), password, remember)
      navigate(safeRedirectPath(location.state), { replace: true })
    } catch (e) {
      if (isLikelyNetworkFailure(e)) {
        setErr(
          'Сервер API недоступен. Запустите BFF (из корня: npm run dev) или проверьте VITE_API_BASE_URL в .env — см. .env.example в корне репозитория.'
        )
      } else {
        setErr(e instanceof Error ? e.message : 'Не удалось войти')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-aztec font-sans text-catskill">
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1400px] flex-col justify-center px-6 py-10 max-[360px]:px-3 max-[360px]:py-6 md:px-10 md:py-[70px] lg:flex-row lg:items-center lg:gap-16 xl:gap-[100px]">
        <section className="mb-10 hidden w-full max-w-md flex-col gap-8 lg:mb-0 lg:flex xl:max-w-[448px]">
          <div className="inline-flex w-fit items-center gap-2 rounded border border-turquoise/30 bg-turquoise/5 px-3 py-1.5">
            <span className="size-2 shrink-0 rounded-full bg-turquoise" aria-hidden />
            <span className="font-mono text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-turquoise">
              {sprintBadgeLabel}
            </span>
          </div>

          <h1 className="text-4xl font-bold leading-[1.1] tracking-[-1.2px] text-white xl:text-5xl xl:leading-[1.05]">
            Войди в <span className="text-turquoise">арену</span>.<br />
            Покажи код.
          </h1>

          <p className="max-w-[448px] font-mono text-sm font-normal leading-[23px] text-gull">
            Basalt Arena — площадка для разработчиков, где каждый спринт превращается в честное
            соревнование за баллы, ранг и реальные деньги.
          </p>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1 rounded-xl border border-plantation bg-timber/20 p-4">
              <p className="text-2xl font-bold leading-8 text-white">
                {meta.marketing?.fighters ?? '—'}
              </p>
              <p className="font-mono text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-slate-arena">
                Бойцов
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-plantation bg-timber/20 p-4">
              <p className="text-2xl font-bold leading-8 text-turquoise">
                {meta.sprintTeaser?.sprintNumber ?? '—'}
              </p>
              <p className="font-mono text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-slate-arena">
                Текущий спринт
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-xl border border-plantation bg-timber/20 p-4">
              <p className="text-2xl font-bold leading-8 text-spring">
                {meta.marketing?.prizePoolShort ?? '—'}
              </p>
              <p className="font-mono text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-slate-arena">
                {'Призовых \u00a0'}
                {meta.marketing?.prizeCurrency ?? '\u20bd'}
              </p>
            </div>
          </div>

          <ul className="flex flex-col gap-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <MaterialIcon
                  name={f.icon}
                  size={24}
                  opticalSize={24}
                  className="mt-0.5 shrink-0 text-turquoise"
                />
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-5 text-white">{f.title}</p>
                  <p className="mt-1 font-mono text-xs leading-4 text-slate-arena">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto w-full max-w-[448px] shrink-0 max-[360px]:max-w-full lg:mx-0">
          <div className="relative isolate overflow-hidden rounded-2xl border border-plantation bg-timber p-8 max-[360px]:p-4">
            <div className="relative z-[1] flex flex-col gap-6 max-[360px]:gap-4">
              <div className="flex items-start justify-between gap-4 max-[360px]:gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-mono text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-slate-arena">
                    // auth.access()
                  </p>
                  <h2 className="text-xl font-semibold leading-7 tracking-[-0.3px] text-white max-[360px]:text-lg">
                    Авторизация
                  </h2>
                </div>
                <div
                  className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-turquoise/25 bg-turquoise/10 max-[360px]:size-10"
                  aria-hidden
                >
                  <MaterialIcon name="lock" size={20} opticalSize={20} className="text-turquoise" />
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-plantation bg-aztec/50 px-3 py-2 max-[360px]:px-2.5">
                <span className="size-2 shrink-0 rounded-full bg-spring" aria-hidden />
                <p className="font-mono text-[10px] font-bold uppercase leading-[15px] tracking-[1px] text-slate-arena max-[360px]:text-[9px] max-[360px]:leading-3">
                  Только вход. Аккаунты выдаются администратором.
                </p>
              </div>

              <form className="flex flex-col gap-5 max-[360px]:gap-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase leading-4 tracking-[1.2px] text-gull">
                    Логин или email
                  </label>
                  <div className="relative">
                    <MaterialIcon
                      name="person"
                      size={18}
                      opticalSize={18}
                      className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-slate-arena"
                    />
                    <input
                      type="text"
                      autoComplete="username"
                      value={loginOrEmail}
                      onChange={(e) => {
                        dismissErr()
                        setLoginOrEmail(e.target.value)
                      }}
                      className="box-border h-[45px] w-full rounded-lg border border-plantation bg-aztec py-2.5 pl-10 pr-4 font-sans text-base font-normal leading-5 text-white outline-none placeholder:text-fiord focus:border-turquoise/40 focus:ring-1 focus:ring-turquoise/20 max-[360px]:h-11 max-[360px]:text-[15px]"
                      placeholder="dev_architect"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-bold uppercase leading-4 tracking-[1.2px] text-gull">
                      Пароль
                    </label>
                    <button
                      type="button"
                      className="shrink-0 font-mono text-[10px] leading-[15px] text-turquoise transition hover:underline"
                      onClick={() => {
                        dismissErr()
                        setInfo(
                          'Восстановление пароля в мок-режиме недоступно — используйте тестовый пароль.'
                        )
                      }}
                    >
                      Забыл?
                    </button>
                  </div>
                  <div className="relative">
                    <MaterialIcon
                      name="key"
                      size={18}
                      opticalSize={18}
                      className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-slate-arena"
                    />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        dismissErr()
                        setPassword(e.target.value)
                      }}
                      className={`box-border h-[45px] w-full rounded-lg border border-plantation bg-aztec py-2.5 pl-10 pr-11 font-sans font-normal text-white outline-none placeholder:text-fiord focus:border-turquoise/40 focus:ring-1 focus:ring-turquoise/20 ${
                        showPassword
                          ? 'text-base leading-5 tracking-normal'
                          : 'text-[8px] leading-5 tracking-[0.14em] md:text-base md:tracking-normal'
                      }`}
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-slate-arena transition hover:bg-white/5 hover:text-catskill"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <MaterialIcon
                        name={showPassword ? 'visibility_off' : 'visibility'}
                        size={18}
                        opticalSize={18}
                      />
                    </button>
                  </div>
                </div>

                <label className="group flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="peer sr-only"
                  />
                  <span className="relative inline-flex size-4 shrink-0 items-center justify-center rounded border border-plantation bg-aztec transition-colors after:content-['✓'] after:text-[11px] after:font-bold after:text-aztec after:opacity-0 after:transition-opacity peer-checked:border-turquoise peer-checked:bg-turquoise peer-checked:after:opacity-100 peer-focus-visible:ring-2 peer-focus-visible:ring-turquoise/30" />
                  <span className="font-mono text-xs leading-4 text-gull transition-colors group-hover:text-catskill max-[360px]:text-[11px] max-[360px]:leading-4">
                    Запомнить сессию на 30 дней
                  </span>
                </label>

                <AuthFeedback info={info} err={err} errRef={errRef} />

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={pending}
                    className="flex h-[48px] w-full items-center justify-center gap-2 rounded-lg bg-turquoise font-sans text-sm font-semibold leading-5 text-white transition-colors duration-150 hover:bg-[#0ab0d4] disabled:cursor-not-allowed disabled:opacity-60 max-[360px]:h-11"
                  >
                    <MaterialIcon name="login" size={18} opticalSize={18} className="text-white" />
                    {pending ? 'Вход…' : 'Войти в арену'}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-plantation" />
                  <span className="shrink-0 font-mono text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-fiord">
                    или через
                  </span>
                  <div className="h-px flex-1 bg-plantation" />
                </div>

                <div className="flex gap-2 max-[360px]:gap-1.5">
                  <button
                    type="button"
                    className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-lg border border-plantation bg-aztec/50 font-sans text-sm font-medium leading-5 text-[#CBD5E1] transition hover:bg-white/5 max-[360px]:h-11 max-[360px]:text-[13px]"
                    title="Скоро"
                    onClick={() => {
                      dismissErr()
                      setInfo('Вход через GitHub появится позже.')
                    }}
                  >
                    <MaterialIcon
                      name="code"
                      size={18}
                      opticalSize={18}
                      className="text-[#CBD5E1]"
                    />
                    GitHub
                  </button>
                  <button
                    type="button"
                    className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-lg border border-plantation bg-aztec/50 font-sans text-sm font-medium leading-5 text-[#CBD5E1] transition hover:bg-white/5 max-[360px]:h-11 max-[360px]:text-[13px]"
                    title="Скоро"
                    onClick={() => {
                      dismissErr()
                      setInfo('Вход через Telegram появится позже.')
                    }}
                  >
                    <MaterialIcon
                      name="send"
                      size={18}
                      opticalSize={18}
                      className="text-[#CBD5E1]"
                    />
                    Telegram
                  </button>
                </div>
              </form>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
