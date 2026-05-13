import { useEffect, useState } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { api } from './api.js'
import { ShellLayout } from './components/ShellLayout.jsx'
import { AchievementsPage } from './pages/AchievementsPage.jsx'
import { AccessPage } from './pages/AccessPage.jsx'
import { AuditLogsPage } from './pages/AuditLogsPage.jsx'
import { DashboardPage } from './pages/DashboardPage.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { SprintsPage } from './pages/SprintsPage.jsx'
import { SubmissionsPage } from './pages/SubmissionsPage.jsx'
import { UsersPage } from './pages/UsersPage.jsx'

function useAuthed() {
  const loc = useLocation()
  const [ready, setReady] = useState(false)
  const [ok, setOk] = useState(false)
  useEffect(() => {
    let c = true
    ;(async () => {
      try {
        await api('/me')
        if (c) setOk(true)
      } catch {
        if (c) setOk(false)
      } finally {
        if (c) setReady(true)
      }
    })()
    return () => {
      c = false
    }
  }, [loc.pathname])
  return { ready, ok }
}

function RequireAuth() {
  const { ready, ok } = useAuthed()
  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 p-8">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-plantation" />
        <span className="text-gull">Загрузка…</span>
      </div>
    )
  }
  if (!ok) return <Navigate to="/login" replace />
  return <Outlet />
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<ShellLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/sprints" element={<SprintsPage />} />
          <Route path="/access" element={<AccessPage />} />
          <Route path="/submissions" element={<SubmissionsPage />} />
          <Route path="/achievements" element={<AchievementsPage />} />
          <Route path="/logs" element={<AuditLogsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
