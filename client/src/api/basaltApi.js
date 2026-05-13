// VITE_API_BASE_URL: пусто → относительный /api/v1 (dev: Vite прокси на BFF, см. vite.config и client/.env.example).
const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '')
const BASE = `${API_BASE_URL}/api/v1`
const ACCESS_KEY = 'basalt_access_token'
const REFRESH_KEY = 'basalt_refresh_token'
const PERSIST_KEY = 'basalt_persist_session'

function safe(fn) {
  try {
    return fn()
  } catch {
    return undefined
  }
}

function storageFor(persist) {
  return persist ? localStorage : sessionStorage
}

export function getStoredToken() {
  return (
    safe(() => localStorage.getItem(ACCESS_KEY)) ??
    safe(() => sessionStorage.getItem(ACCESS_KEY)) ??
    null
  )
}

export function getStoredRefreshToken() {
  return (
    safe(() => localStorage.getItem(REFRESH_KEY)) ??
    safe(() => sessionStorage.getItem(REFRESH_KEY)) ??
    null
  )
}

function isPersisted() {
  return safe(() => localStorage.getItem(PERSIST_KEY) === '1') ?? false
}

export function setStoredTokens(tokens, opts = {}) {
  const persist = opts.persist !== false
  safe(() => {
    if (!tokens) {
      localStorage.removeItem(ACCESS_KEY)
      localStorage.removeItem(REFRESH_KEY)
      localStorage.removeItem(PERSIST_KEY)
      sessionStorage.removeItem(ACCESS_KEY)
      sessionStorage.removeItem(REFRESH_KEY)
      return
    }
    const target = storageFor(persist)
    const other = storageFor(!persist)
    if (tokens.accessToken) target.setItem(ACCESS_KEY, tokens.accessToken)
    if (tokens.refreshToken) target.setItem(REFRESH_KEY, tokens.refreshToken)
    other.removeItem(ACCESS_KEY)
    other.removeItem(REFRESH_KEY)
    if (persist) {
      localStorage.setItem(PERSIST_KEY, '1')
    } else {
      localStorage.removeItem(PERSIST_KEY)
    }
  })
}

// Back-compat shim used by older callers expecting `setStoredToken(token)`.
export function setStoredToken(token, opts = {}) {
  if (!token) {
    setStoredTokens(null)
  } else {
    setStoredTokens({ accessToken: token }, opts)
  }
}

let refreshPromise = null
let onSessionExpired = null

export function onAuthExpired(callback) {
  onSessionExpired = callback
}

async function refreshTokensOnce() {
  if (refreshPromise) return refreshPromise
  const refreshToken = getStoredRefreshToken()
  if (!refreshToken) return null
  refreshPromise = (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
      if (!res.ok) {
        if (res.status === 400 || res.status === 401) {
          setStoredTokens(null)
        }
        return null
      }
      const data = await res.json().catch(() => null)
      if (!data?.accessToken || !data?.refreshToken) return null
      setStoredTokens(
        { accessToken: data.accessToken, refreshToken: data.refreshToken },
        { persist: isPersisted() }
      )
      return data
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()
  return refreshPromise
}

async function rawRequest(path, options = {}, token) {
  return fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body && !options.headers?.['Content-Type']
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...options.headers,
    },
  })
}

async function request(path, options = {}) {
  let token = getStoredToken()
  let res = await rawRequest(path, options, token)
  if (res.status === 401 && getStoredRefreshToken() && !path.startsWith('/auth/')) {
    const refreshed = await refreshTokensOnce()
    if (refreshed?.accessToken) {
      token = refreshed.accessToken
      res = await rawRequest(path, options, token)
    } else {
      setStoredTokens(null)
      onSessionExpired?.()
    }
  }
  const text = await res.text()
  let data
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }
  if (!res.ok) {
    const msg = data?.message ?? data?.error ?? res.statusText
    const error = new Error(msg || `HTTP ${res.status}`)
    error.status = res.status
    error.code = data?.code
    error.details = data?.details
    throw error
  }
  return data
}

export async function postLogin(credentials) {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  })
}

export async function postRegister(payload, opts = {}) {
  const devKey = opts.devKey ? String(opts.devKey) : ''
  return request('/auth/register', {
    method: 'POST',
    headers: devKey ? { 'x-dev-register-key': devKey } : {},
    body: JSON.stringify(payload),
  })
}

export function postLogout() {
  return request('/auth/logout', { method: 'POST' })
}

export function getMe() {
  return request('/me')
}

export function patchProfile(payload) {
  return request('/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export async function postNotificationsRead() {
  const res = await request('/me/notifications/read', { method: 'POST' })
  return { notificationsUnread: Number(res?.unreadCount ?? 0) || 0 }
}

export async function getMeta() {
  const res = await request('/meta')
  return {
    build: String(res?.build ?? 'v0.0.0'),
    serverTimeUtcDisplay: String(res?.serverTimeUtcDisplay ?? '00:00'),
    copyrightYear: Number(res?.copyrightYear ?? new Date().getUTCFullYear()),
    sprintTeaser: res?.sprintTeaser ?? null,
    marketing: res?.marketing ?? null,
  }
}

export function postSubmission(payload) {
  return request('/submissions', { method: 'POST', body: JSON.stringify(payload) })
}

export function getHall(sortBy = 'efficiency') {
  return request(`/hall?sortBy=${encodeURIComponent(sortBy)}`)
}

export function getSprintsV2() {
  return request('/sprints')
}

export function getSprintByIdV2(id) {
  return request(`/sprints/${id}`)
}

export function getSprintSolutionsV2(id, sortBy = 'efficiency') {
  return request(`/sprints/${id}/solutions?sortBy=${encodeURIComponent(sortBy)}`)
}

export function postSprintSubmissionV2(id, payload) {
  return request(`/sprints/${id}/submissions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function putSolutionLike(id) {
  return request(`/solutions/${id}/like`, { method: 'PUT' })
}

export function deleteSolutionLike(id) {
  return request(`/solutions/${id}/like`, { method: 'DELETE' })
}
