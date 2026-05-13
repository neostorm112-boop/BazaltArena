import { Award, FileCode2, History, Home, KeyRound, LogOut, Trophy, Users } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { clearSession, postLogout } from '../api.js'
import { Button } from './ui/button.jsx'

const navCls = ({ isActive }) =>
  `flex items-center gap-3 rounded-xl px-3 py-2.5 font-mono text-xs font-bold uppercase tracking-wide transition ${
    isActive
      ? 'bg-gradient-to-r from-turquoise/20 to-transparent text-turquoise'
      : 'text-gull hover:bg-white/[0.04] hover:text-catskill'
  }`

const items = [
  { to: '/', label: 'Главная', icon: Home },
  { to: '/users', label: 'Пользователи', icon: Users },
  { to: '/sprints', label: 'Спринты', icon: Trophy },
  { to: '/access', label: 'Доступы', icon: KeyRound },
  { to: '/submissions', label: 'Решения', icon: FileCode2 },
  { to: '/achievements', label: 'Ачивки', icon: Award },
  { to: '/logs', label: 'Логи', icon: History },
]

export function ShellLayout() {
  const logout = async () => {
    try {
      await postLogout()
    } catch {
      /* */
    }
    clearSession()
    window.location.href = '/login'
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-60 shrink-0 flex-col border-r border-plantation bg-gradient-to-b from-timber to-aztec p-4">
        <div className="mb-8 px-2">
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.25em] text-turquoise">
            Basalt
          </div>
          <div className="mt-1 text-lg font-semibold tracking-tight text-catskill">
            Админка арены
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'} className={navCls}>
              <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
        <Button variant="outline" className="mt-6 w-full py-2.5" onClick={() => void logout()}>
          <LogOut className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
          Выйти
        </Button>
      </aside>
      <main className="min-w-0 flex-1 overflow-auto bg-aztec/50 p-6 md:p-10">
        <Outlet />
      </main>
    </div>
  )
}
