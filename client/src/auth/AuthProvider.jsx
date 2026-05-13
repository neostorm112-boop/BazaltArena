import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getMe,
  getStoredToken,
  onAuthExpired,
  postLogin,
  postLogout,
  postNotificationsRead,
  setStoredTokens,
} from '../api/basaltApi.js'
import { queryKeys } from '../lib/queryKeys.js'
import { AuthContext } from './context.js'

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [accessToken, setAccessToken] = useState(() => getStoredToken())
  const [user, setUser] = useState(null)
  const [activeSprint, setActiveSprint] = useState(null)
  const [stats, setStats] = useState(null)
  const [profile, setProfile] = useState(null)
  const [sprintHistory, setSprintHistory] = useState(null)
  const [notificationsUnread, setNotificationsUnread] = useState(0)
  const [notifications, setNotifications] = useState([])

  const applyMe = useCallback((me) => {
    setUser(me.user)
    setActiveSprint(me.activeSprint ?? null)
    setStats(me.stats ?? null)
    setProfile(me.profile ?? null)
    setSprintHistory(me.sprintHistory ?? null)
    setNotificationsUnread(me.notificationsUnread ?? 0)
    setNotifications(Array.isArray(me.notifications) ? me.notifications : [])
  }, [])

  const clearSession = useCallback(() => {
    setUser(null)
    setActiveSprint(null)
    setStats(null)
    setProfile(null)
    setSprintHistory(null)
    setNotificationsUnread(0)
    setNotifications([])
  }, [])

  const meQuery = useQuery({
    queryKey: queryKeys.me(),
    queryFn: getMe,
    enabled: Boolean(accessToken),
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  })

  useEffect(() => {
    if (meQuery.data) applyMe(meQuery.data)
  }, [meQuery.data, applyMe])

  useEffect(() => {
    if (!accessToken || !meQuery.isError) return
    setStoredTokens(null)
    setAccessToken(null)
    queryClient.removeQueries({ queryKey: queryKeys.me() })
    clearSession()
  }, [accessToken, meQuery.isError, clearSession, queryClient])

  const ready = useMemo(() => {
    if (!accessToken) return true
    return meQuery.isSuccess || meQuery.isError
  }, [accessToken, meQuery.isSuccess, meQuery.isError])

  const loadSession = useCallback(() => {
    setAccessToken(getStoredToken())
    void queryClient.invalidateQueries({ queryKey: queryKeys.me() })
  }, [queryClient])

  useEffect(() => {
    setAccessToken(getStoredToken())
  }, [])

  useEffect(() => {
    onAuthExpired(() => {
      setStoredTokens(null)
      setAccessToken(null)
      queryClient.removeQueries({ queryKey: queryKeys.me() })
      clearSession()
    })
    return () => onAuthExpired(null)
  }, [clearSession, queryClient])

  const login = useCallback(
    async (email, password, rememberSession = true) => {
      const res = await postLogin({ email, password })
      setStoredTokens(
        { accessToken: res.accessToken, refreshToken: res.refreshToken },
        { persist: rememberSession }
      )
      const t = getStoredToken()
      setAccessToken(t)
      const me = await queryClient.fetchQuery({
        queryKey: queryKeys.me(),
        queryFn: getMe,
        staleTime: 0,
      })
      applyMe(me)
    },
    [applyMe, queryClient]
  )

  const logout = useCallback(async () => {
    try {
      await postLogout()
    } catch (_error) {
      void _error
    }
    setStoredTokens(null)
    setAccessToken(null)
    queryClient.removeQueries({ queryKey: queryKeys.me() })
    clearSession()
  }, [clearSession, queryClient])

  const markNotificationsRead = useCallback(async () => {
    try {
      const res = await postNotificationsRead()
      setNotificationsUnread(res.notificationsUnread ?? 0)
      void queryClient.invalidateQueries({ queryKey: queryKeys.me() })
    } catch {
      setNotificationsUnread(0)
    }
  }, [queryClient])

  const value = useMemo(
    () => ({
      ready,
      user,
      activeSprint,
      stats,
      profile,
      sprintHistory,
      notificationsUnread,
      notifications,
      login,
      logout,
      markNotificationsRead,
      refreshSession: loadSession,
    }),
    [
      ready,
      user,
      activeSprint,
      stats,
      profile,
      sprintHistory,
      notificationsUnread,
      notifications,
      login,
      logout,
      markNotificationsRead,
      loadSession,
    ]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
