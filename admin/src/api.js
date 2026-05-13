const BASE = '/api/v1'
const ACCESS = 'basalt_admin_access'
const REFRESH = 'basalt_admin_refresh'

/** Ошибка HTTP API с кодом статуса (для UI: 403 vs миграции и т.д.) */
export class ApiRequestError extends Error {
  /** @param {string} message @param {{ status?: number, code?: string }} [meta] */
  constructor(message, meta = {}) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = meta.status
    this.code = meta.code
  }
}

function getAccess() {
  try {
    return localStorage.getItem(ACCESS)
  } catch {
    return null
  }
}

/** Access JWT for Socket.io `auth.token` (same rules as REST Bearer). */
export function getAdminAccessToken() {
  return getAccess()
}

function getRefresh() {
  try {
    return localStorage.getItem(REFRESH)
  } catch {
    return null
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(ACCESS)
    localStorage.removeItem(REFRESH)
  } catch {
    /* ignore */
  }
}

export function setSession(tokens) {
  if (!tokens?.accessToken) {
    clearSession()
    return
  }
  localStorage.setItem(ACCESS, tokens.accessToken)
  localStorage.setItem(REFRESH, tokens.refreshToken)
}

let refreshPromise = null
async function refreshOnce() {
  const rt = getRefresh()
  if (!rt) return null
  if (refreshPromise) return refreshPromise
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      })
      if (!res.ok) return null
      const data = await res.json()
      if (data?.accessToken && data?.refreshToken) setSession(data)
      return data
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

/** Человекочитаемое сообщение для Sonner: Zod flatten, message с бэка, 409 и т.д. */
export function formatApiErrorMessage(status, body) {
  if (body && typeof body === 'object') {
    const d = body.details
    if (d && typeof d === 'object') {
      const fe = d.fieldErrors
      if (fe && typeof fe === 'object') {
        for (const msgs of Object.values(fe)) {
          if (Array.isArray(msgs) && msgs[0]) return String(msgs[0])
        }
      }
      if (Array.isArray(d.formErrors)) {
        const first = d.formErrors.find(Boolean)
        if (first) return String(first)
      }
    }
    if (typeof body.message === 'string' && body.message.trim()) return body.message.trim()
  }
  if (status === 409)
    return 'Конфликт данных (запись уже существует или нарушено уникальное ограничение).'
  if (status === 400) return 'Некорректный запрос. Проверьте поля формы.'
  return `Запрос не выполнен (HTTP ${status})`
}

export async function api(path, opts = {}) {
  let token = getAccess()
  let res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.body && !opts.headers?.['Content-Type']
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...opts.headers,
    },
  })
  if (res.status === 401 && getRefresh() && !path.startsWith('/auth/')) {
    const d = await refreshOnce()
    if (d?.accessToken) {
      token = d.accessToken
      res = await fetch(`${BASE}${path}`, {
        ...opts,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
          ...(opts.body && !opts.headers?.['Content-Type']
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...opts.headers,
        },
      })
    } else clearSession()
  }
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg = formatApiErrorMessage(res.status, data)
    throw new ApiRequestError(msg, { status: res.status, code: data?.code })
  }
  return data
}

export function postLogin(body) {
  return api('/auth/login', { method: 'POST', body: JSON.stringify(body) })
}

export function postLogout() {
  return api('/auth/logout', { method: 'POST' })
}
