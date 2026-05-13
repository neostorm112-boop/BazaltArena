import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth.js'

export function ProtectedRoute({ children }) {
  const { ready, user } = useAuth()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-aztec font-sans text-sm text-half-baked">
        Загрузка…
      </div>
    )
  }

  if (!user) {
    const from = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to="/login" replace state={{ from }} />
  }

  return children
}
