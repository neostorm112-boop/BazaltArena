import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, FileUser, History, Layers, Medal, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api.js'
import { auditLogDescription, auditLogTitle } from '../lib/auditLogLabels.js'
import { ROLE_LABEL, roleLabel, submissionStatusLabel } from '../lib/copy.js'
import { Button } from './ui/button.jsx'
import { ConfirmDialog } from './ui/confirm-dialog.jsx'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './ui/dialog.jsx'
import { HintRow } from './ui/hint-row.jsx'
import { Input } from './ui/input.jsx'
import { Label } from './ui/label.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select.jsx'
import { Sheet, SheetBody, SheetContent, SheetHeader } from './ui/sheet.jsx'
import { Skeleton } from './ui/skeleton.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs.jsx'

const LOG_PAGE_SIZE = 8

/** Значок: имя из набора иконок арены (латиница через подчёркивание) или эмодзи / текст. */
function isMaterialSymbolName(icon) {
  if (!icon || typeof icon !== 'string') return false
  const s = icon.trim()
  return s.length > 0 && s.length <= 64 && /^[a-z][a-z0-9_]*$/.test(s)
}

function AchievementGlyph({ icon, size = 'md' }) {
  const raw = (icon ?? '').trim()
  const sizeCls = size === 'sm' ? 'text-[18px]' : 'text-[22px]'
  if (!raw) {
    return (
      <span className={`font-sans leading-none ${sizeCls}`} aria-hidden>
        🏅
      </span>
    )
  }
  if (isMaterialSymbolName(raw)) {
    return (
      <span
        className={`material-symbols-outlined inline-flex shrink-0 items-center justify-center font-normal leading-none text-turquoise/80 ${sizeCls}`}
        aria-hidden
      >
        {raw}
      </span>
    )
  }
  return (
    <span className={`inline-flex shrink-0 font-sans leading-none ${sizeCls}`} aria-hidden>
      {raw}
    </span>
  )
}

function sameStack(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

function buildFormFromUser(u) {
  return {
    email: u.email ?? '',
    handle: u.handle ?? '',
    role: u.role ?? 'USER',
    points: u.points ?? 0,
    realName: u.realName ?? '',
    bio: u.bio ?? '',
    telegram: u.telegram ?? '',
    github: u.github ?? '',
    stack: Array.isArray(u.stack) ? [...u.stack] : [],
    moneyEarned: u.moneyEarned ?? 0,
  }
}

function buildPatch(user, form) {
  const body = {}
  const nextEmail = (form.email ?? '').trim().toLowerCase()
  const curEmail = (user.email ?? '').trim().toLowerCase()
  if (nextEmail !== curEmail) body.email = nextEmail
  if (form.handle !== user.handle) body.handle = form.handle
  if (form.role !== user.role) body.role = form.role
  if (Number(form.points) !== Number(user.points)) body.points = Number(form.points)
  if ((form.realName ?? '').trim() !== (user.realName ?? '').trim())
    body.realName = (form.realName ?? '').trim()
  if ((form.bio ?? '') !== (user.bio ?? '')) body.bio = form.bio ?? ''
  if ((form.telegram ?? '').trim() !== (user.telegram ?? '').trim())
    body.telegram = (form.telegram ?? '').trim()
  if ((form.github ?? '').trim() !== (user.github ?? '').trim())
    body.github = (form.github ?? '').trim()
  if (!sameStack(form.stack, user.stack ?? [])) body.stack = form.stack
  if (Number(form.moneyEarned) !== Number(user.moneyEarned ?? 0))
    body.moneyEarned = Number(form.moneyEarned)
  return body
}

export function UserEditSheet({ user, open, onOpenChange, isPending, onSave }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState('account')
  const [tagInput, setTagInput] = useState('')
  const [form, setForm] = useState(null)
  const [logPage, setLogPage] = useState(0)
  const [grantAchievementId, setGrantAchievementId] = useState('')
  const [revokeConfirm, setRevokeConfirm] = useState(null)
  const [sprintDetailSprintId, setSprintDetailSprintId] = useState(null)

  useEffect(() => {
    if (user) {
      setForm(buildFormFromUser(user))
      setTagInput('')
      setTab('account')
      setLogPage(0)
      setGrantAchievementId('')
      setRevokeConfirm(null)
      setSprintDetailSprintId(null)
    } else {
      setForm(null)
    }
  }, [user])

  useEffect(() => {
    if (!open) {
      setRevokeConfirm(null)
      setSprintDetailSprintId(null)
    }
  }, [open])

  useEffect(() => {
    if (tab !== 'sprints') setSprintDetailSprintId(null)
  }, [tab])

  const canSubmit = useMemo(() => Boolean(user && form), [user, form])

  const { data: logData, isPending: logPending } = useQuery({
    queryKey: ['admin', 'audit-logs', user?.id, logPage, LOG_PAGE_SIZE],
    queryFn: () => {
      const q = new URLSearchParams({
        skip: String(logPage * LOG_PAGE_SIZE),
        take: String(LOG_PAGE_SIZE),
        userId: user.id,
      })
      return api(`/admin/audit-logs?${q}`)
    },
    enabled: open && !!user && tab === 'logs',
  })

  const { data: earnedRes, isPending: achPending } = useQuery({
    queryKey: ['admin', 'users', user?.id, 'achievements'],
    queryFn: () => api(`/admin/users/${user.id}/achievements`),
    enabled: open && !!user && tab === 'achievements',
  })

  const { data: allAchRes } = useQuery({
    queryKey: ['admin', 'achievements'],
    queryFn: () => api('/admin/achievements'),
    enabled: open && !!user && tab === 'achievements',
  })

  const { data: sprintActivityRes, isPending: sprintsPending } = useQuery({
    queryKey: ['admin', 'users', user?.id, 'sprints'],
    queryFn: () => api(`/admin/users/${user.id}/sprints`),
    enabled: open && !!user && tab === 'sprints',
  })

  const earned = earnedRes?.items ?? []
  const earnedIds = useMemo(() => new Set(earned.map((r) => r.achievementId)), [earned])
  const allAchievements = allAchRes?.achievements ?? []
  const grantable = useMemo(
    () => allAchievements.filter((a) => !earnedIds.has(a.id)),
    [allAchievements, earnedIds]
  )

  const grantMut = useMutation({
    mutationFn: (achievementId) =>
      api(`/admin/users/${user.id}/achievements/${achievementId}`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Ачивка выдана')
      setGrantAchievementId('')
      void qc.invalidateQueries({ queryKey: ['admin', 'users', user.id, 'achievements'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'audit-logs', user.id] })
      void qc.invalidateQueries({ queryKey: ['admin', 'audit-logs'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const revokeMut = useMutation({
    mutationFn: (achievementId) =>
      api(`/admin/users/${user.id}/achievements/${achievementId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Ачивка отозвана')
      void qc.invalidateQueries({ queryKey: ['admin', 'users', user.id, 'achievements'] })
      void qc.invalidateQueries({ queryKey: ['admin', 'audit-logs', user.id] })
      void qc.invalidateQueries({ queryKey: ['admin', 'audit-logs'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const addTag = (raw) => {
    const t = raw.trim()
    if (!t || !form) return
    if (form.stack.includes(t)) {
      setTagInput('')
      return
    }
    if (form.stack.length >= 30) {
      toast.error('Не больше 30 тегов в стеке')
      return
    }
    setForm((f) => ({ ...f, stack: [...f.stack, t] }))
    setTagInput('')
  }

  const handleSave = () => {
    if (!user || !form) return
    const body = buildPatch(user, form)
    if (Object.keys(body).length === 0) {
      toast.message('Нет изменений для сохранения')
      return
    }
    onSave(user.id, body)
  }

  const logTotal = logData?.total ?? 0
  const logPageCount = Math.max(1, Math.ceil(logTotal / LOG_PAGE_SIZE))
  const logItems = logData?.items ?? []

  const sprintRows = sprintActivityRes?.items ?? []
  const sprintDetailRow = useMemo(
    () => sprintRows.find((r) => r.sprint?.id === sprintDetailSprintId) ?? null,
    [sprintRows, sprintDetailSprintId]
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-full sm:max-w-2xl">
        {user && form ? (
          <>
            <SheetHeader title="Пользователь" description={user.email} />
            <SheetBody>
              <Tabs value={tab} onValueChange={setTab} className="w-full">
                <TabsList className="mb-3 grid h-auto w-full grid-cols-2 gap-1.5 p-1.5 sm:grid-cols-5">
                  <TabsTrigger
                    value="account"
                    className="flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-center sm:flex-row sm:gap-2"
                  >
                    <User className="h-4 w-4 shrink-0 text-turquoise/90" strokeWidth={1.75} />
                    <span className="leading-tight">Аккаунт</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="profile"
                    className="flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-center sm:flex-row sm:gap-2"
                  >
                    <FileUser className="h-4 w-4 shrink-0 text-turquoise/90" strokeWidth={1.75} />
                    <span className="leading-tight">Профиль</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="logs"
                    className="flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-center sm:flex-row sm:gap-2"
                  >
                    <History className="h-4 w-4 shrink-0 text-turquoise/90" strokeWidth={1.75} />
                    <span className="leading-tight">Логи</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="achievements"
                    className="flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-center sm:flex-row sm:gap-2"
                  >
                    <Medal className="h-4 w-4 shrink-0 text-turquoise/90" strokeWidth={1.75} />
                    <span className="leading-tight">Ачивки</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="sprints"
                    className="flex flex-col items-center justify-center gap-1 rounded-lg px-2 py-2.5 text-center sm:flex-row sm:gap-2"
                  >
                    <Layers className="h-4 w-4 shrink-0 text-turquoise/90" strokeWidth={1.75} />
                    <span className="leading-tight">Спринты</span>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="account" className="space-y-4">
                  <div>
                    <Label>Ник</Label>
                    <Input
                      className="mt-1 font-mono"
                      value={form.handle}
                      onChange={(e) => setForm((f) => ({ ...f, handle: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Роль</Label>
                    <Select
                      value={form.role}
                      onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Выберите роль" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USER">{ROLE_LABEL.USER}</SelectItem>
                        <SelectItem value="ADMIN">{ROLE_LABEL.ADMIN}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Баллы</Label>
                    <Input
                      type="number"
                      min={0}
                      className="mt-1"
                      value={form.points}
                      onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Почта</Label>
                    <Input
                      type="email"
                      className="mt-1 font-mono"
                      value={form.email}
                      onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    />
                    <HintRow className="mt-1.5" icon="info">
                      Смена почты только через админку. Пользователь в личном кабинете меняет ник,
                      Telegram и GitHub.
                    </HintRow>
                  </div>
                </TabsContent>

                <TabsContent value="profile" className="space-y-4">
                  <div>
                    <Label>Имя</Label>
                    <Input
                      className="mt-1"
                      value={form.realName}
                      maxLength={120}
                      onChange={(e) => setForm((f) => ({ ...f, realName: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>О себе</Label>
                    <textarea
                      className="mt-1 min-h-[88px] w-full resize-y rounded-lg border border-plantation bg-aztec px-3 py-2 font-sans text-sm text-catskill outline-none ring-turquoise/30 placeholder:text-gull focus:ring-2"
                      maxLength={500}
                      value={form.bio}
                      onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
                    />
                    <p className="mt-0.5 text-[10px] text-gull">{(form.bio ?? '').length}/500</p>
                  </div>
                  <div>
                    <Label>Телеграм</Label>
                    <Input
                      className="mt-1"
                      value={form.telegram}
                      maxLength={64}
                      onChange={(e) => setForm((f) => ({ ...f, telegram: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Гитхаб</Label>
                    <Input
                      className="mt-1 font-mono text-xs"
                      placeholder="@ник или полная ссылка"
                      value={form.github}
                      maxLength={512}
                      onChange={(e) => setForm((f) => ({ ...f, github: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Стек (теги)</Label>
                    <div className="mt-1 flex flex-wrap gap-1.5 rounded-lg border border-plantation bg-timber/30 px-2 py-2">
                      {form.stack.map((tag, idx) => (
                        <span
                          key={`${idx}-${tag}`}
                          className="inline-flex items-center gap-1 rounded-md bg-aztec px-2 py-0.5 font-mono text-[10px] text-turquoise"
                        >
                          {tag}
                          <button
                            type="button"
                            className="text-gull hover:text-catskill"
                            aria-label={`Удалить ${tag}`}
                            onClick={() =>
                              setForm((f) => ({ ...f, stack: f.stack.filter((x) => x !== tag) }))
                            }
                          >
                            ×
                          </button>
                        </span>
                      ))}
                      <input
                        className="min-w-[120px] flex-1 bg-transparent px-1 py-0.5 text-sm text-catskill outline-none"
                        placeholder="Добавить… Enter"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addTag(tagInput)
                          }
                          if (e.key === 'Backspace' && !tagInput && form.stack.length > 0) {
                            setForm((f) => ({ ...f, stack: f.stack.slice(0, -1) }))
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Заработано (₽, целое)</Label>
                    <Input
                      type="number"
                      min={0}
                      className="mt-1"
                      value={form.moneyEarned}
                      onChange={(e) => setForm((f) => ({ ...f, moneyEarned: e.target.value }))}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="logs" className="space-y-3">
                  <HintRow icon="history_edu">
                    Журнал по этому человеку: что он делал сам, что у него меняли другие, и
                    упоминания в связанных событиях.
                  </HintRow>
                  <div className="overflow-hidden rounded-xl border border-plantation">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-plantation bg-aztec/90 font-mono text-[9px] uppercase tracking-wide text-slate-arena">
                        <tr>
                          <th className="w-[108px] p-2">Время</th>
                          <th className="p-2">Кто</th>
                          <th className="p-2">Событие</th>
                        </tr>
                      </thead>
                      <tbody>
                        {logPending
                          ? Array.from({ length: 4 }).map((_, i) => (
                              <tr key={i} className="border-b border-plantation/40">
                                <td className="p-2">
                                  <Skeleton className="h-3 w-20" />
                                </td>
                                <td className="p-2">
                                  <Skeleton className="h-3 w-24" />
                                </td>
                                <td className="p-2">
                                  <Skeleton className="h-3 w-32" />
                                </td>
                              </tr>
                            ))
                          : logItems.map((row) => (
                              <tr
                                key={row.id}
                                className="border-b border-plantation/40 align-top last:border-0"
                              >
                                <td className="whitespace-nowrap p-2 font-mono text-[10px] text-gull">
                                  {new Date(row.createdAt).toLocaleString()}
                                </td>
                                <td className="p-2">
                                  <div className="font-mono text-[10px] text-turquoise">
                                    @{row.actor?.handle}
                                  </div>
                                  <div className="text-[9px] text-slate-arena">
                                    {roleLabel(row.actor?.role)}
                                  </div>
                                </td>
                                <td className="p-2">
                                  <div className="font-sans text-[11px] font-medium leading-snug text-catskill">
                                    {auditLogTitle(row.action)}
                                  </div>
                                  <div className="mt-1 max-h-28 overflow-y-auto whitespace-pre-wrap break-words font-sans text-[10px] leading-snug text-gull">
                                    {auditLogDescription(row.action, row.details)}
                                  </div>
                                </td>
                              </tr>
                            ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] text-gull">
                      Стр. {logPage + 1}/{logPageCount} · всего {logTotal}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-2 py-0"
                        disabled={logPage <= 0}
                        onClick={() => setLogPage((p) => Math.max(0, p - 1))}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-2 py-0"
                        disabled={logPage + 1 >= logPageCount}
                        onClick={() => setLogPage((p) => p + 1)}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="achievements" className="space-y-4">
                  <HintRow icon="workspace_premium">
                    Выдача и отзыв наград. Список такой же, как в разделе «Ачивки» слева в меню.
                  </HintRow>
                  <div className="rounded-xl border border-plantation bg-timber/25 p-3">
                    <Label className="text-[10px]">Добавить ачивку</Label>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1">
                        <Select
                          value={grantAchievementId || undefined}
                          onValueChange={setGrantAchievementId}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Выберите из списка" />
                          </SelectTrigger>
                          <SelectContent>
                            {grantable.map((a) => (
                              <SelectItem key={a.id} value={a.id}>
                                <span className="flex min-w-0 items-center gap-2">
                                  <AchievementGlyph icon={a.icon} size="sm" />
                                  <span className="truncate">{a.title}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="gradient"
                        className="shrink-0 py-2"
                        disabled={
                          !grantAchievementId || grantMut.isPending || grantable.length === 0
                        }
                        onClick={() => grantAchievementId && grantMut.mutate(grantAchievementId)}
                      >
                        Выдать
                      </Button>
                    </div>
                    {grantable.length === 0 ? (
                      <p className="mt-2 font-sans text-[10px] text-gull">
                        Все ачивки из справочника уже выданы.
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <Label className="text-[10px]">Полученные</Label>
                    <ul className="mt-2 space-y-2">
                      {achPending ? (
                        <Skeleton className="h-16 w-full rounded-xl" />
                      ) : earned.length === 0 ? (
                        <li className="rounded-xl border border-dashed border-plantation px-3 py-6 text-center font-sans text-xs text-gull">
                          Пока нет ни одной ачивки.
                        </li>
                      ) : (
                        earned.map((row) => (
                          <li
                            key={row.id}
                            className="flex items-start justify-between gap-3 rounded-xl border border-plantation bg-aztec/40 px-3 py-3"
                          >
                            <div className="flex min-w-0 flex-1 items-start gap-2.5">
                              <div className="mt-0.5 shrink-0">
                                <AchievementGlyph icon={row.achievement?.icon} size="sm" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="font-sans text-base font-semibold leading-snug tracking-tight text-catskill">
                                  {row.achievement?.title}
                                </div>
                                <p className="mt-1 line-clamp-2 font-sans text-xs leading-relaxed text-gull">
                                  {row.achievement?.subtitle}
                                </p>
                                <p className="mt-1.5 font-mono text-[10px] text-slate-arena">
                                  {new Date(row.earnedAt).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <Button
                              type="button"
                              variant="danger"
                              className="shrink-0 py-1.5 text-[10px]"
                              disabled={revokeMut.isPending}
                              onClick={() =>
                                setRevokeConfirm({
                                  achievementId: row.achievementId,
                                  title: row.achievement?.title ?? '',
                                })
                              }
                            >
                              Отозвать
                            </Button>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="sprints" className="space-y-3">
                  <HintRow icon="event">
                    Спринты, где есть отправленная работа или отдельно выданный доступ. Активный —
                    текущий бой на арене. Откройте строку, чтобы увидеть ссылки на репозиторий и
                    демо.
                  </HintRow>
                  {sprintsPending ? (
                    <Skeleton className="h-36 w-full rounded-xl" />
                  ) : sprintRows.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-plantation px-3 py-8 text-center font-sans text-xs text-gull">
                      Нет данных: ни отправок, ни выданного доступа к спринтам.
                    </p>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-plantation">
                      <table className="w-full min-w-[520px] text-left text-xs">
                        <thead className="border-b border-plantation bg-aztec/90 font-mono text-[9px] uppercase tracking-wide text-slate-arena">
                          <tr>
                            <th className="min-w-0 p-2">Спринт</th>
                            <th className="w-[92px] p-2">Состояние</th>
                            <th className="min-w-[160px] p-2">Результат</th>
                            <th className="w-[96px] p-2 text-right">Детали</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sprintRows.map((row) => {
                            const s = row.sprint
                            const sub = row.submission
                            const acc = row.access
                            return (
                              <tr
                                key={s.id}
                                className="border-b border-plantation/40 align-top last:border-0"
                              >
                                <td className="p-2">
                                  <div className="font-sans text-sm font-semibold leading-snug text-catskill">
                                    {s.title}
                                  </div>
                                  <div className="mt-0.5 font-mono text-[10px] text-gull">
                                    {s.slug}
                                  </div>
                                  {s.tabLabel ? (
                                    <div className="mt-0.5 text-[10px] text-slate-arena">
                                      подпись вкладки: {s.tabLabel}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="p-2">
                                  {s.active ? (
                                    <span className="inline-block rounded-md bg-turquoise/15 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-turquoise">
                                      Активный
                                    </span>
                                  ) : (
                                    <span className="font-mono text-[10px] text-gull">Архив</span>
                                  )}
                                </td>
                                <td className="p-2">
                                  {sub ? (
                                    <div className="space-y-0.5">
                                      <div className="text-[11px] leading-snug text-catskill">
                                        {submissionStatusLabel(sub.status)} · {sub.mentorScore} б. ·
                                        лайки {sub.likesCount}
                                      </div>
                                      <div className="font-mono text-[9px] text-slate-arena">
                                        обновлено {new Date(sub.updatedAt).toLocaleString()}
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-gull">Нет отправки</span>
                                  )}
                                  {acc ? (
                                    <div className="mt-1.5 font-mono text-[9px] leading-snug text-slate-arena">
                                      доступ: отправка {acc.canSubmit ? 'да' : 'нет'}, просмотр{' '}
                                      {acc.canView ? 'да' : 'нет'}
                                    </div>
                                  ) : sub ? (
                                    <div className="mt-1.5 text-[9px] text-slate-arena">
                                      Доступ по умолчанию (как у участника без отдельной записи).
                                    </div>
                                  ) : null}
                                </td>
                                <td className="p-2 text-right">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="py-1.5 text-[10px]"
                                    onClick={() => setSprintDetailSprintId(s.id)}
                                  >
                                    Открыть
                                  </Button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {(tab === 'account' || tab === 'profile') && (
                <div className="mt-6 flex gap-2 border-t border-plantation pt-4">
                  <Button
                    type="button"
                    variant="gradient"
                    disabled={!canSubmit || isPending}
                    onClick={handleSave}
                  >
                    Сохранить
                  </Button>
                  <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                    Отмена
                  </Button>
                </div>
              )}
            </SheetBody>
          </>
        ) : null}
      </SheetContent>

      <Dialog open={!!sprintDetailRow} onOpenChange={(o) => !o && setSprintDetailSprintId(null)}>
        <DialogContent className="max-h-[min(90vh,36rem)] max-w-xl overflow-y-auto">
          {sprintDetailRow && user ? (
            <>
              <DialogTitle>Участие в спринте</DialogTitle>
              <DialogDescription className="sr-only">
                Детали участия в спринте: доступ, отправка, ссылки.
              </DialogDescription>
              <p className="mt-2 text-sm text-catskill">
                {sprintDetailRow.sprint.title} · @{user.handle}
              </p>

              <div className="mt-3 space-y-2 text-xs text-gull">
                <p>
                  <span className="text-slate-arena">Короткий адрес страницы:</span>{' '}
                  <span className="font-mono text-[10px] text-catskill">
                    {sprintDetailRow.sprint.slug}
                  </span>
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  {sprintDetailRow.sprint.active ? (
                    <span className="rounded-md bg-turquoise/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-turquoise">
                      Активный спринт
                    </span>
                  ) : (
                    <span className="rounded-md border border-plantation px-2 py-0.5 font-mono text-[10px] text-gull">
                      Архив
                    </span>
                  )}
                </div>
                {(() => {
                  const starts = sprintDetailRow.sprint.startsAt
                  const ends = sprintDetailRow.sprint.endsAt
                  if (!starts && !ends) return null
                  const bits = []
                  if (starts) bits.push(`с ${new Date(starts).toLocaleString()}`)
                  if (ends) bits.push(`до ${new Date(ends).toLocaleString()}`)
                  return (
                    <p className="font-mono text-[10px] text-slate-arena">{bits.join(' · ')}</p>
                  )
                })()}
              </div>

              <div className="mt-4 space-y-4 border-t border-plantation pt-4">
                <div>
                  <p className="text-xs font-semibold text-catskill">Доступ</p>
                  {sprintDetailRow.access ? (
                    <p className="mt-1 font-sans text-sm text-catskill">
                      Отправка: {sprintDetailRow.access.canSubmit ? 'разрешена' : 'нет'}
                      {', '}
                      просмотр зала: {sprintDetailRow.access.canView ? 'да' : 'нет'}
                    </p>
                  ) : (
                    <p className="mt-1 font-sans text-sm text-gull">
                      Отдельной записи доступа нет — действуют правила по умолчанию для участника.
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-catskill">Отправка</p>
                  {sprintDetailRow.submission ? (
                    <div className="mt-2 space-y-3">
                      <div className="rounded-lg border border-plantation bg-aztec/40 px-3 py-2 font-sans text-sm text-catskill">
                        <div className="text-[11px]">
                          <span className="text-gull">Статус:</span>{' '}
                          {submissionStatusLabel(sprintDetailRow.submission.status)}
                        </div>
                        <div className="mt-1 text-[11px]">
                          <span className="text-gull">Баллы ментора:</span>{' '}
                          {sprintDetailRow.submission.mentorScore}
                        </div>
                        <div className="mt-1 text-[11px]">
                          <span className="text-gull">Лайки:</span>{' '}
                          {sprintDetailRow.submission.likesCount}
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-slate-arena">
                          создано {new Date(sprintDetailRow.submission.createdAt).toLocaleString()}
                          {' · '}
                          обновлено{' '}
                          {new Date(sprintDetailRow.submission.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <a
                          href={sprintDetailRow.submission.repoUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block break-all font-mono text-xs text-turquoise underline decoration-turquoise/40 underline-offset-2 hover:decoration-turquoise"
                        >
                          Репозиторий → {sprintDetailRow.submission.repoUrl}
                        </a>
                        {sprintDetailRow.submission.demoUrl ? (
                          <a
                            href={sprintDetailRow.submission.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block break-all font-mono text-xs text-turquoise underline decoration-turquoise/40 underline-offset-2 hover:decoration-turquoise"
                          >
                            Демо → {sprintDetailRow.submission.demoUrl}
                          </a>
                        ) : (
                          <p className="font-sans text-xs text-gull">Ссылка на демо не указана.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-1 font-sans text-sm text-gull">
                      По этому спринту работа ещё не отправлена.
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!revokeConfirm}
        onOpenChange={(o) => !o && !revokeMut.isPending && setRevokeConfirm(null)}
        title="Отозвать ачивку?"
        description={
          revokeConfirm && user
            ? `Ачивка «${revokeConfirm.title}» будет снята с пользователя @${user.handle}.`
            : ''
        }
        cancelLabel="Отмена"
        confirmLabel="Отозвать"
        confirmVariant="danger"
        isPending={revokeMut.isPending}
        onConfirm={() => {
          if (!revokeConfirm) return
          revokeMut.mutate(revokeConfirm.achievementId, {
            onSuccess: () => setRevokeConfirm(null),
          })
        }}
      />
    </Sheet>
  )
}
