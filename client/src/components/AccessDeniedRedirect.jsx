import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

/** Маршруты, при попадании на которые юзер видит «Доступ запрещён» — иначе тихо редиректим. */
const FORBIDDEN_PATTERNS = [/^\/admin(\/|$)/i, /^\/sprints\/edit(\/|$)/i]

const REDIRECT_DELAY_MS = 1500

/**
 * Catch-all для путей, которые в клиенте отсутствуют (включая админские).
 * Если путь похож на админский — показываем плашку «Доступ запрещён» и редиректим
 * через короткую паузу. Для прочих неизвестных путей — обычный молчаливый редирект.
 */
export function AccessDeniedRedirect() {
  const location = useLocation()
  const isForbidden = FORBIDDEN_PATTERNS.some((re) => re.test(location.pathname))
  const [redirect, setRedirect] = useState(!isForbidden)

  useEffect(() => {
    if (!isForbidden) return undefined
    const t = setTimeout(() => setRedirect(true), REDIRECT_DELAY_MS)
    return () => clearTimeout(t)
  }, [isForbidden])

  if (redirect) return <Navigate to="/" replace />

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-lg border border-rose-500/40 bg-aztec/95 px-4 py-3 text-sm text-mystic shadow-lg"
    >
      <p className="font-semibold text-rose-300">Доступ запрещён</p>
      <p className="mt-1 text-gull">Эта страница доступна только администраторам.</p>
    </div>
  )
}
