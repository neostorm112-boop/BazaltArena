import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth.js'
import { MaterialIcon } from '../ui/MaterialIcon.jsx'

function dicebearAvatar(seed) {
  const q = new URLSearchParams({
    seed: String(seed ?? 'user'),
    scale: '62',
    radius: '12',
  })
  return `https://api.dicebear.com/7.x/identicon/svg?${q.toString()}`
}

export function AppHeader() {
  const { pathname } = useLocation()
  const { user, notificationsUnread, notifications, logout, markNotificationsRead } = useAuth()
  const [notifOpen, setNotifOpen] = useState(false)
  const [marking, setMarking] = useState(false)
  const panelRef = useRef(null)

  const avatarSrc = user?.avatarUrl?.trim() || dicebearAvatar(user?.handle ?? user?.id ?? 'user')

  useEffect(() => {
    if (!notifOpen) return
    function onDocMouseDown(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setNotifOpen(false)
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setNotifOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [notifOpen])

  if (!user) return null

  const navItems = [
    { label: 'Активный спринт', to: '/', active: pathname === '/', disabled: false },
    { label: 'Зал славы', to: '/hall', active: pathname === '/hall', disabled: false },
    { label: 'Документация', to: '/docs', active: pathname === '/docs', disabled: false },
  ]

  async function onMarkAllRead() {
    setMarking(true)
    try {
      await markNotificationsRead()
    } finally {
      setMarking(false)
      setNotifOpen(false)
    }
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 min-h-[73px] border-b border-plantation bg-aztec">
      <div className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between gap-0 px-6 max-[360px]:px-3 md:px-10">
        <div className="flex min-w-0 shrink items-center gap-6 max-[360px]:gap-3 md:gap-10">
          <Link to="/" className="flex shrink-0 items-center gap-3 leading-none">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-turquoise/10 max-[360px]:size-9">
              <MaterialIcon name="terminal" size={24} opticalSize={24} className="text-turquoise" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-lg font-bold uppercase leading-[18px] tracking-[-0.45px] text-white max-[360px]:text-base max-[360px]:leading-4">
                Basalt
              </span>
              <span className="font-mono text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-slate-arena max-[360px]:text-[9px] max-[360px]:leading-3">
                Арена v4.2
              </span>
            </div>
          </Link>

          <nav className="hidden min-w-0 items-center gap-1 md:flex">
            {navItems.map((item) =>
              item.disabled ? (
                <span
                  key={item.label}
                  className="cursor-not-allowed whitespace-nowrap rounded-lg px-2 py-2 text-sm font-medium leading-5 opacity-40 text-fiord xl:px-4"
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  key={item.label}
                  to={item.to}
                  className={[
                    'whitespace-nowrap rounded-lg px-2 py-2 text-sm leading-5 xl:px-4',
                    item.active && 'bg-turquoise/10 font-bold text-turquoise',
                    !item.active && 'font-medium text-gull hover:text-catskill',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {item.label}
                </Link>
              )
            )}
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-2 max-[360px]:gap-1 xl:gap-3">
          <button
            type="button"
            onClick={logout}
            className="hidden shrink-0 rounded-lg px-2 py-1.5 text-xs font-medium text-gull transition hover:bg-white/5 hover:text-catskill xl:inline-flex"
          >
            Выйти
          </button>

          <div className="relative">
            {notifOpen ? (
              <div
                className="fixed inset-0 z-[55] bg-aztec/55 backdrop-blur-[1px] md:hidden"
                aria-hidden
                onPointerDown={() => setNotifOpen(false)}
              />
            ) : null}
            <div className="relative" ref={panelRef}>
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                className="relative flex size-10 items-center justify-center rounded-lg text-gull transition hover:bg-white/5 hover:text-catskill max-[360px]:size-9"
                aria-label="Уведомления"
                aria-expanded={notifOpen}
              >
                <MaterialIcon
                  name="notifications"
                  size={24}
                  opticalSize={24}
                  className="leading-none text-gull [font-variation-settings:'FILL'_0,'wght'_400,'GRAD'_0,'opsz'_24]"
                />
                {notificationsUnread > 0 ? (
                  <span className="absolute right-2 top-2 size-2 rounded-full bg-turquoise ring-2 ring-aztec" />
                ) : null}
              </button>

              {notifOpen ? (
                <div
                  className="z-[60] flex max-h-[min(75dvh,28rem)] w-[min(calc(100vw-1.5rem),20rem)] flex-col overflow-hidden rounded-xl border border-plantation bg-timber py-3 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] max-md:fixed max-md:inset-x-3 max-md:top-[calc(73px+0.5rem)] max-md:mt-0 max-md:w-auto max-md:max-h-[min(78dvh,calc(100dvh-73px-1.25rem))] max-md:pb-4 md:absolute md:right-0 md:top-full md:mt-2 md:max-h-[min(70dvh,22rem)] md:pb-3"
                  role="dialog"
                  aria-label="Уведомления"
                >
                  <div className="shrink-0 border-b border-plantation px-4 pb-2 max-md:px-4">
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[1px] text-half-baked">
                      Уведомления
                    </p>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 max-md:px-3">
                    {notifications.length > 0 ? (
                      <ul className="flex flex-col gap-2">
                        {notifications.map((row) => (
                          <li
                            key={row.id}
                            className={[
                              'rounded-lg border border-plantation/80 bg-aztec/50 px-3 py-2.5 max-md:px-3.5 max-md:py-3',
                              row.unread
                                ? 'border-l-[3px] border-l-turquoise pl-[calc(0.75rem-2px)]'
                                : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            <p className="text-xs font-semibold text-catskill max-md:text-[13px]">
                              {row.title}
                            </p>
                            <p className="mt-1 whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-half-baked max-md:text-xs max-md:leading-snug">
                              {row.body}
                            </p>
                            <p className="mt-1.5 font-mono text-[10px] text-fiord">
                              {row.createdAt
                                ? new Date(row.createdAt).toLocaleString('ru-RU', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="px-2 py-6 text-center font-mono text-xs leading-relaxed text-half-baked max-md:py-8 max-md:text-[13px]">
                        Нет новых уведомлений
                      </p>
                    )}
                  </div>
                  {notificationsUnread > 0 ? (
                    <div className="shrink-0 border-t border-plantation px-3 pt-2 max-md:px-3 max-md:pt-3">
                      <button
                        type="button"
                        disabled={marking}
                        onClick={onMarkAllRead}
                        className="min-h-[44px] w-full rounded-lg bg-turquoise/15 py-2.5 font-mono text-xs font-semibold text-turquoise transition hover:bg-turquoise/25 disabled:opacity-50 max-md:text-[13px] md:min-h-0 md:py-2"
                      >
                        {marking ? '…' : 'Отметить прочитанным'}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <Link
            to="/profile"
            className={[
              'flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 leading-none transition hover:bg-white/5 max-[360px]:gap-1 max-[360px]:pr-1 xl:gap-3 xl:pr-3',
              pathname === '/profile' ? 'bg-turquoise/5 ring-1 ring-turquoise/25' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label="Профиль"
          >
            <div
              aria-hidden
              className="relative size-9 shrink-0 overflow-hidden rounded-lg border border-plantation bg-aztec"
            >
              <img
                src={avatarSrc}
                alt=""
                className="pointer-events-none absolute inset-0 block h-full w-full max-w-none object-cover object-[50%_38%]"
                decoding="async"
                draggable={false}
              />
            </div>
            <div className="hidden min-w-0 flex-col justify-center text-left xl:flex">
              <div className="text-xs font-semibold leading-tight text-mystic">{user.handle}</div>
              <div className="font-mono text-[10px] leading-tight text-slate-arena">
                {user.role}
              </div>
            </div>
            <MaterialIcon
              name="expand_more"
              size={18}
              opticalSize={18}
              className="hidden shrink-0 leading-none text-slate-arena md:inline [font-variation-settings:'FILL'_0,'wght'_400,'GRAD'_0,'opsz'_18]"
            />
          </Link>
        </div>
      </div>
    </header>
  )
}
