import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api.js'
import { Button } from '../components/ui/button.jsx'
import { Checkbox } from '../components/ui/checkbox.jsx'
import { HintRow } from '../components/ui/hint-row.jsx'
import { Input } from '../components/ui/input.jsx'
import { Label } from '../components/ui/label.jsx'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select.jsx'
import { Skeleton } from '../components/ui/skeleton.jsx'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'

export function AccessPage() {
  const qc = useQueryClient()
  const [sid, setSid] = useState('')
  const [userQuery, setUserQuery] = useState('')
  const debouncedUserQuery = useDebouncedValue(userQuery, 350)
  const [pickedUser, setPickedUser] = useState(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [canSubmit, setCanSubmit] = useState(true)
  const [canView, setCanView] = useState(true)
  const [savingRowUserId, setSavingRowUserId] = useState(null)
  const pickerWrapRef = useRef(null)

  const { data: sprintsRes } = useQuery({
    queryKey: ['admin', 'sprints'],
    queryFn: () => api('/admin/sprints'),
  })
  const sprints = sprintsRes?.sprints ?? []

  useEffect(() => {
    if (!sid && sprints[0]?.id) setSid(sprints[0].id)
  }, [sid, sprints])

  useEffect(() => {
    setPickedUser(null)
    setUserQuery('')
    setPickerOpen(false)
  }, [sid])

  const { data: accessRes, isPending } = useQuery({
    queryKey: ['admin', 'access', sid],
    queryFn: () => api(`/admin/sprints/${sid}/access`),
    enabled: Boolean(sid),
  })
  const rows = accessRes?.access ?? []

  const accessFingerprint = useMemo(
    () => rows.map((r) => `${r.userId}:${r.canSubmit}:${r.canView}`).join('|'),
    [rows]
  )

  const [drafts, setDrafts] = useState({})
  useEffect(() => {
    const next = {}
    for (const r of rows) {
      next[r.userId] = { canSubmit: r.canSubmit, canView: r.canView }
    }
    setDrafts(next)
  }, [sid, accessFingerprint])

  const pickerSearch = debouncedUserQuery.trim()
  const { data: pickerUsersRes, isFetching: pickerFetching } = useQuery({
    queryKey: ['admin', 'users', 'access-picker', pickerSearch],
    queryFn: () => {
      const q = new URLSearchParams({ take: '10', skip: '0' })
      if (pickerSearch) q.set('search', pickerSearch)
      return api(`/admin/users?${q}`)
    },
    enabled: pickerOpen && pickerSearch.length >= 1,
  })
  const pickerItems = pickerUsersRes?.items ?? []

  useEffect(() => {
    const onDoc = (e) => {
      if (!pickerWrapRef.current?.contains(e.target)) setPickerOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  async function saveAccessForUser(userId, nextSubmit, nextView) {
    if (!sid || !userId) return
    await api(`/admin/sprints/${sid}/access`, {
      method: 'PUT',
      body: JSON.stringify({ userId, canSubmit: nextSubmit, canView: nextView }),
    })
    toast.success('Доступ сохранён')
    await qc.invalidateQueries({ queryKey: ['admin', 'access', sid] })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold uppercase tracking-tight text-catskill">
          Доступы
        </h1>
        <p className="mt-2 text-sm text-gull">
          Выдача прав на выбранный спринт. Изменения подтягиваются у всех открытых экранов без
          перезагрузки.
        </p>
      </div>

      <div className="max-w-md">
        <Label>Спринт</Label>
        {sprints.length > 0 ? (
          <Select value={sid || undefined} onValueChange={setSid}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Выберите спринт" />
            </SelectTrigger>
            <SelectContent>
              {sprints.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <p className="mt-2 font-sans text-sm text-gull">
            Спринтов пока нет — добавьте их в разделе «Спринты».
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-plantation bg-timber/30 p-5">
        <Label>Выдать или обновить доступ одному пользователю</Label>
        <HintRow className="mt-1 max-w-xl" icon="person_search">
          Введите начало ника — покажем до 10 совпадений. Выберите человека из списка, отметьте
          права и нажмите «Сохранить».
        </HintRow>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div ref={pickerWrapRef} className="relative min-w-[220px] flex-1">
            <Input
              placeholder="Префикс ника (например dev_)"
              className="font-mono text-xs"
              value={userQuery}
              autoComplete="off"
              aria-autocomplete="list"
              aria-expanded={pickerOpen}
              onChange={(e) => {
                const v = e.target.value
                setUserQuery(v)
                if (pickedUser && v !== pickedUser.handle) setPickedUser(null)
                setPickerOpen(true)
              }}
              onFocus={() => setPickerOpen(true)}
            />
            {pickerOpen && pickerSearch.length >= 1 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-auto rounded-lg border border-plantation bg-aztec py-1 shadow-lg">
                {pickerFetching && (
                  <div className="px-3 py-2 font-sans text-xs text-gull">Поиск…</div>
                )}
                {!pickerFetching && pickerItems.length === 0 && (
                  <div className="px-3 py-2 font-sans text-xs text-gull">Нет совпадений</div>
                )}
                {pickerItems.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left font-sans text-xs hover:bg-timber/60"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setPickedUser({ id: u.id, handle: u.handle, email: u.email })
                      setUserQuery(u.handle)
                      setPickerOpen(false)
                    }}
                  >
                    <span className="font-mono text-turquoise">{u.handle}</span>
                    <span className="text-[11px] text-gull">{u.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 font-sans text-xs text-gull">
            <Checkbox checked={canSubmit} onCheckedChange={(v) => setCanSubmit(!!v)} />
            Может сдавать решение
          </label>
          <label className="flex cursor-pointer items-center gap-2 font-sans text-xs text-gull">
            <Checkbox checked={canView} onCheckedChange={(v) => setCanView(!!v)} />
            Видит спринт и зал
          </label>
          <Button
            variant="gradient"
            disabled={!sid || !pickedUser}
            onClick={async () => {
              if (!sid || !pickedUser) return
              try {
                await saveAccessForUser(pickedUser.id, canSubmit, canView)
                setPickedUser(null)
                setUserQuery('')
              } catch (e) {
                toast.error(e instanceof Error ? e.message : 'Ошибка')
              }
            }}
          >
            Сохранить
          </Button>
        </div>
        {pickedUser && (
          <p className="mt-2 font-mono text-[10px] uppercase tracking-wide text-slate-arena">
            Выбран <span className="text-turquoise">{pickedUser.handle}</span>
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-plantation">
        <table className="w-full text-sm">
          <thead className="border-b border-plantation bg-aztec/80 font-mono text-[10px] uppercase text-slate-arena">
            <tr>
              <th className="p-3 text-left">Пользователь</th>
              <th className="p-3 text-left">Сдача</th>
              <th className="p-3 text-left">Просмотр</th>
              <th className="p-3 text-left"> </th>
            </tr>
          </thead>
          <tbody>
            {isPending
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-plantation/40">
                    <td className="p-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="p-3">
                      <Skeleton className="h-4 w-10" />
                    </td>
                    <td className="p-3">
                      <Skeleton className="h-4 w-10" />
                    </td>
                    <td className="p-3">
                      <Skeleton className="h-8 w-20" />
                    </td>
                  </tr>
                ))
              : rows.map((r) => {
                  const resolved = drafts[r.userId] ?? {
                    canSubmit: r.canSubmit,
                    canView: r.canView,
                  }
                  const dirty = resolved.canSubmit !== r.canSubmit || resolved.canView !== r.canView
                  return (
                    <tr key={r.id} className="border-b border-plantation/40">
                      <td className="p-3 font-mono text-xs text-turquoise">{r.user?.handle}</td>
                      <td className="p-3">
                        <label className="flex cursor-pointer items-center gap-2 font-sans text-xs text-gull">
                          <Checkbox
                            checked={resolved.canSubmit}
                            onCheckedChange={(v) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [r.userId]: {
                                  canSubmit: !!v,
                                  canView: prev[r.userId]?.canView ?? r.canView,
                                },
                              }))
                            }
                            aria-label="Может сдавать решение"
                          />
                        </label>
                      </td>
                      <td className="p-3">
                        <label className="flex cursor-pointer items-center gap-2 font-sans text-xs text-gull">
                          <Checkbox
                            checked={resolved.canView}
                            onCheckedChange={(v) =>
                              setDrafts((prev) => ({
                                ...prev,
                                [r.userId]: {
                                  canSubmit: prev[r.userId]?.canSubmit ?? r.canSubmit,
                                  canView: !!v,
                                },
                              }))
                            }
                            aria-label="Видит спринт и зал"
                          />
                        </label>
                      </td>
                      <td className="p-3">
                        <Button
                          type="button"
                          variant="outline"
                          className="px-3 py-1.5 font-mono text-[10px] uppercase"
                          disabled={!sid || !dirty || savingRowUserId === r.userId}
                          onClick={async () => {
                            if (!sid) return
                            setSavingRowUserId(r.userId)
                            try {
                              await saveAccessForUser(
                                r.userId,
                                resolved.canSubmit,
                                resolved.canView
                              )
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : 'Ошибка')
                            } finally {
                              setSavingRowUserId(null)
                            }
                          }}
                        >
                          {savingRowUserId === r.userId ? '…' : 'Сохранить'}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
