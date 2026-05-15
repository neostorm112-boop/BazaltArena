import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DayPicker } from 'react-day-picker'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import slugify from 'slugify'
import { api } from '../api.js'
import { Button } from '../components/ui/button.jsx'
import { Checkbox } from '../components/ui/checkbox.jsx'
import { Input } from '../components/ui/input.jsx'
import { Label } from '../components/ui/label.jsx'
import { ConfirmDialog } from '../components/ui/confirm-dialog.jsx'
import { Sheet, SheetBody, SheetContent, SheetHeader } from '../components/ui/sheet.jsx'
import { Skeleton } from '../components/ui/skeleton.jsx'
import { HintRow } from '../components/ui/hint-row.jsx'
import { cn } from '../lib/cn.js'
import 'react-day-picker/style.css'
import '../sprint-day-picker-scope.css'

function toIsoEndOfDay(d) {
  if (!d) return undefined
  const x = new Date(d)
  x.setUTCHours(23, 59, 59, 999)
  return x.toISOString()
}

function toIsoStartOfDay(d) {
  if (!d) return undefined
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x.toISOString()
}

function slugFromTitle(title) {
  const s = slugify(String(title ?? ''), { lower: true, strict: true, trim: true })
  return s.length > 0 ? s.slice(0, 120) : 'sprint'
}

/** Доля времени от старта к финишу (0…1), null если нет обеих дат. */
function sprintTimeFraction(s, nowMs = Date.now()) {
  if (!s?.startsAt || !s?.endsAt) return null
  const t0 = new Date(s.startsAt).getTime()
  const t1 = new Date(s.endsAt).getTime()
  if (t1 <= t0) return 1
  return Math.max(0, Math.min(1, (nowMs - t0) / (t1 - t0)))
}

function sprintTimeProgressPct(s, nowMs = Date.now()) {
  const f = sprintTimeFraction(s, nowMs)
  return f == null ? null : Math.round(f * 1000) / 10
}

/** По датам: финиш в прошлом или шкала времени дошла до 100%. */
function isSprintTemporallyFinished(s, nowMs = Date.now()) {
  if (s.endsAt && new Date(s.endsAt).getTime() <= nowMs) return true
  const f = sprintTimeFraction(s, nowMs)
  return f != null && f >= 1
}

/** Текущий «логический» статус для выпадающего списка (совпадает с секциями списка). */
function sprintUiStatus(s, nowMs = Date.now()) {
  if (s.archived) return 'archive'
  if (s.active && !isSprintTemporallyFinished(s, nowMs)) return 'active'
  if (isSprintTemporallyFinished(s, nowMs)) return 'finished'
  return 'planned'
}

const DAY_MS = 24 * 60 * 60 * 1000

/** PATCH: снять с арены / из архива в «запланирован» — при необходимости продлить дедлайн. */
function patchBodyForPlanned(s, nowMs = Date.now()) {
  const base = { active: false, archived: false }
  const endT = s.endsAt ? new Date(s.endsAt).getTime() : 0
  if (endT > nowMs) return base
  const now = new Date(nowMs)
  const end = new Date(nowMs + 14 * DAY_MS)
  return {
    ...base,
    startsAt: toIsoStartOfDay(now),
    endsAt: toIsoEndOfDay(end),
  }
}

/** PATCH: принудительно «завершён по календарю» (дедлайн в прошлом). */
function patchBodyForFinished(_s, nowMs = Date.now()) {
  const yesterday = new Date(nowMs - DAY_MS)
  const endsAt = toIsoEndOfDay(yesterday)
  const endMs = new Date(endsAt).getTime()
  const startsAt = toIsoStartOfDay(new Date(endMs - 7 * DAY_MS))
  return { active: false, archived: false, startsAt, endsAt }
}

/**
 * Арена — только активный по флагу и ещё не «логически завершён».
 * Завершённые — прошлый финиш или прогресс 100% (в т.ч. активный по флагу, но с истёкшими датами).
 */
function partitionSprints(list, nowMs = Date.now()) {
  const archived = []
  const activeArena = []
  const planned = []
  const finished = []
  for (const s of list) {
    if (s.archived) {
      archived.push(s)
      continue
    }
    if (isSprintTemporallyFinished(s, nowMs)) {
      finished.push(s)
      continue
    }
    if (s.active) {
      activeArena.push(s)
      continue
    }
    planned.push(s)
  }
  const byStart = (a, b) => {
    const ta = a.startsAt ? new Date(a.startsAt).getTime() : Infinity
    const tb = b.startsAt ? new Date(b.startsAt).getTime() : Infinity
    return ta - tb
  }
  const byEndDesc = (a, b) => {
    const ta = a.endsAt ? new Date(a.endsAt).getTime() : 0
    const tb = b.endsAt ? new Date(b.endsAt).getTime() : 0
    return tb - ta
  }
  planned.sort(byStart)
  finished.sort(byEndDesc)
  return { activeArena, planned, finished, archived }
}

function formatProgressCaption(s, nowMs = Date.now()) {
  if (!s?.startsAt || !s?.endsAt) return 'Задайте старт и финиш — тогда появится прогресс'
  const t1 = new Date(s.endsAt).getTime()
  const done = nowMs >= t1 || sprintTimeFraction(s, nowMs) >= 1
  if (done) {
    return `Завершено ${new Date(s.endsAt).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
  }
  const days = Math.ceil((t1 - nowMs) / (24 * 3600 * 1000))
  if (days <= 0) return 'Финиш сегодня'
  if (days === 1) return 'Остался 1 день'
  if (days >= 2 && days <= 4) return `Осталось ${days} дня`
  return `Осталось ${days} дн.`
}

function SprintTimeBar({ sprint, variant, nowMs }) {
  const pct = sprintTimeProgressPct(sprint, nowMs)
  if (pct == null) return null
  const done = variant === 'done' || isSprintTemporallyFinished(sprint, nowMs)
  const w = done ? 100 : Math.min(100, Math.max(0, pct))
  const arenaGlow =
    variant === 'arena' &&
    sprint.active &&
    !isSprintTemporallyFinished(sprint, nowMs) &&
    'shadow-[0_0_16px_rgba(13,204,242,0.5)]'
  const ongoingGlow = variant === 'ongoing' && !done && 'shadow-[0_0_8px_rgba(13,204,242,0.38)]'
  const track = done ? 'bg-plantation/80' : 'bg-plantation'
  const fill = done ? 'bg-gull/30' : variant === 'ongoing' ? 'bg-turquoise/70' : 'bg-turquoise/40'
  const rimGlow = arenaGlow || ongoingGlow || ''
  return (
    <div className="mt-2 max-w-md">
      <div className="flex justify-between gap-2 font-mono text-[9px] leading-snug text-slate-arena">
        <span className="text-gull">По календарю</span>
        <span className="text-right text-catskill">{formatProgressCaption(sprint, nowMs)}</span>
      </div>
      <div
        className={`relative mt-1.5 h-[5px] overflow-hidden rounded-full ${track} ${rimGlow}`}
        title={`${w}%`}
      >
        <div className={`h-full rounded-full ${fill}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  )
}

function parseTags(raw) {
  return String(raw ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 50)
}

const RESOURCE_ICON_PRESETS = [
  { value: 'terminal', label: 'Терминал' },
  { value: 'description', label: 'Описание' },
  { value: 'link', label: 'Ссылка' },
  { value: 'code', label: 'Код' },
  { value: 'view_quilt', label: 'Сетка' },
  { value: 'open_in_new', label: 'Внешняя ссылка' },
  { value: 'deployed_code', label: 'Деплой' },
  { value: 'folder', label: 'Папка' },
]

function MaterialIconPresetGrid({ value, onPick, idPrefix }) {
  return (
    <div
      className="mt-2 grid grid-cols-8 gap-1.5 max-sm:grid-cols-4"
      role="group"
      aria-label="Выбор значка"
    >
      {RESOURCE_ICON_PRESETS.map((p) => {
        const selected = value === p.value
        return (
          <button
            key={p.value}
            type="button"
            id={idPrefix ? `${idPrefix}-${p.value}` : undefined}
            title={`${p.label} — ${p.value}`}
            aria-label={p.label}
            aria-pressed={selected}
            className={cn(
              'flex h-10 w-full max-w-10 items-center justify-center justify-self-center rounded-lg border transition',
              selected
                ? 'border-turquoise bg-turquoise/15'
                : 'border-plantation hover:border-turquoise/40'
            )}
            onClick={() => onPick(p.value)}
          >
            <span className="material-symbols-outlined text-[22px] text-catskill" aria-hidden>
              {p.value}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function newResourceLinkRow() {
  return {
    id:
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `rl-${Date.now()}-${Math.random()}`,
    label: '',
    href: '',
    icon: 'link',
  }
}

function isValidHttpUrl(s) {
  try {
    const u = new URL(String(s).trim())
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/** @returns {{ ok: true, links: Array<{ label: string; href: string; icon: string }> } | { ok: false, message: string }} */
function buildResourceLinksPayload(rows) {
  const links = []
  for (const r of rows) {
    const label = String(r.label ?? '').trim()
    const href = String(r.href ?? '').trim()
    const icon = String(r.icon ?? 'link').trim() || 'link'
    if (!label && !href) continue
    if (!label || !href) {
      return {
        ok: false,
        message: 'Для каждой строки укажите подпись и URL или очистите строку целиком.',
      }
    }
    if (!isValidHttpUrl(href)) {
      return {
        ok: false,
        message: `Укажите полную ссылку с https:// или http:// — сейчас не подходит: ${href}`,
      }
    }
    links.push({ label, href, icon })
  }
  if (links.length > 20) {
    return { ok: false, message: 'Не более 20 полезных ссылок.' }
  }
  return { ok: true, links }
}

function resourceLinksFromSprintBrief(brief) {
  const raw =
    brief && typeof brief === 'object' && !Array.isArray(brief) ? brief.resourceLinks : null
  if (!Array.isArray(raw)) return []
  return raw
    .filter((x) => x && typeof x === 'object')
    .map((x) => ({
      ...newResourceLinkRow(),
      label: String(x.label ?? ''),
      href: String(x.href ?? ''),
      icon: String(x.icon ?? 'link'),
    }))
}

/** Подпись периода для превью — всегда из календаря (`range`), а не из поля метки. */
function formatSprintRangePreview(range) {
  if (!range?.from) return null
  const from = range.from
  const to = range.to
  if (!to) {
    return `${from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} — …`
  }
  if (from.getTime() === to.getTime()) {
    return from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  }
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()
  if (sameMonth) {
    const month = from.toLocaleDateString('ru-RU', { month: 'long' })
    const y = from.getFullYear()
    return `${from.getDate()}–${to.getDate()} ${month} ${y} г.`
  }
  return `${from.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })} — ${to.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

function SprintPreviewCard({ title, tabLabel, completedLabel, tags, tabIcon, range }) {
  const period = formatSprintRangePreview(range)
  return (
    <div className="rounded-xl border border-plantation bg-timber/80 p-4 shadow-inner">
      <p className="font-mono text-[9px] uppercase tracking-wider text-slate-arena">
        Как выглядит на сайте
      </p>
      <div className="mt-3 flex items-start gap-3">
        {tabIcon ? (
          <span
            className="material-symbols-outlined shrink-0 text-2xl text-turquoise/80"
            aria-hidden
          >
            {tabIcon}
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="font-sans text-lg font-semibold leading-tight text-catskill">
            {title || 'Название'}
          </div>
          <div className="mt-1.5 inline-flex rounded-md bg-white/5 px-2 py-0.5 font-mono text-[10px] text-turquoise">
            {tabLabel || 'Вкладка'}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-1">
            {(tags ?? []).slice(0, 6).map((tag) => (
              <span
                key={tag}
                className="rounded bg-aztec px-1.5 py-0.5 font-mono text-[9px] text-gull"
              >
                {tag}
              </span>
            ))}
            <span className="flex items-center gap-1 rounded-md border border-plantation bg-aztec px-2 py-1 font-mono text-[11px] text-catskill">
              <span className="material-symbols-outlined text-[14px] text-gull" aria-hidden>
                event
              </span>
              {period ?? 'Выберите период в календаре'}
            </span>
          </div>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-wide text-slate-arena">
            Подпись после сдачи
          </p>
          <p className="mt-0.5 font-mono text-[10px] leading-snug text-gull">
            {completedLabel?.trim() ? completedLabel.trim() : 'Сдано'} — такой текст покажется на
            зале рядом со значком события.
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-turquoise">
          {title}
        </h2>
        {subtitle ? <p className="mt-0.5 text-[11px] text-gull">{subtitle}</p> : null}
      </div>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}

export function SprintsPage() {
  const qc = useQueryClient()
  const slugTouched = useRef(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [sheetMode, setSheetMode] = useState('create')
  const [editingId, setEditingId] = useState(null)
  const [range, setRange] = useState(undefined)
  const [form, setForm] = useState({
    slug: '',
    title: '',
    tabLabel: '',
    tabIcon: '',
    completedLabel: 'Сдано',
    tagsRaw: '',
    published: true,
    makeActive: false,
  })
  const [resourceLinks, setResourceLinks] = useState(() => [])
  /** Пересчёт секций и прогресса по календарю без перезагрузки страницы. */
  const [nowTick, setNowTick] = useState(0)
  const [archiveConfirm, setArchiveConfirm] = useState(null)
  useEffect(() => {
    const id = window.setInterval(() => setNowTick((t) => t + 1), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'sprints'],
    queryFn: () => api('/admin/sprints'),
  })

  const sprints = useMemo(() => data?.sprints ?? [], [data?.sprints])
  const nowMs = useMemo(() => {
    void nowTick
    void data?.sprints
    return Date.now()
  }, [nowTick, data?.sprints])
  const groups = useMemo(() => partitionSprints(sprints, nowMs), [sprints, nowMs])

  const resetForm = useCallback(() => {
    slugTouched.current = false
    setEditingId(null)
    setSheetMode('create')
    setRange(undefined)
    setForm({
      slug: '',
      title: '',
      tabLabel: '',
      tabIcon: '',
      completedLabel: 'Сдано',
      tagsRaw: '',
      published: true,
      makeActive: false,
    })
    setResourceLinks([])
  }, [])

  const openCreate = () => {
    resetForm()
    setSheetOpen(true)
  }

  const openEdit = (s) => {
    slugTouched.current = true
    setSheetMode('edit')
    setEditingId(s.id)
    setForm({
      slug: s.slug,
      title: s.title,
      tabLabel: s.tabLabel,
      tabIcon: s.tabIcon ?? '',
      completedLabel: s.completedLabel,
      tagsRaw: Array.isArray(s.tags) ? s.tags.join(', ') : '',
      published: s.published !== false,
      makeActive: !!s.active,
    })
    setResourceLinks(resourceLinksFromSprintBrief(s.brief))
    setRange(
      s.startsAt || s.endsAt
        ? {
            from: s.startsAt ? new Date(s.startsAt) : undefined,
            to: s.endsAt ? new Date(s.endsAt) : undefined,
          }
        : undefined
    )
    setSheetOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: (body) => api('/admin/sprints', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Спринт создан')
      void qc.invalidateQueries({ queryKey: ['admin', 'sprints'] })
      setSheetOpen(false)
      resetForm()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const patchMutation = useMutation({
    mutationFn: ({ id, body }) =>
      api(`/admin/sprints/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: async (_data, variables) => {
      if (variables.makeActive) {
        try {
          await api(`/admin/sprints/${variables.id}/activate`, { method: 'POST' })
        } catch (e) {
          toast.error(e instanceof Error ? e.message : 'Не удалось активировать')
        }
      }
      toast.success('Спринт сохранён')
      void qc.invalidateQueries({ queryKey: ['admin', 'sprints'] })
      setSheetOpen(false)
      resetForm()
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const duplicateMutation = useMutation({
    mutationFn: (id) => api(`/admin/sprints/${id}/duplicate`, { method: 'POST' }),
    onSuccess: (res) => {
      toast.success('Копия создана')
      void qc.invalidateQueries({ queryKey: ['admin', 'sprints'] })
      if (res?.sprint?.id) openEdit(res.sprint)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const statusMutation = useMutation({
    mutationFn: async ({ id, next, sprint }) => {
      if (next === 'active') {
        return api(`/admin/sprints/${id}/activate`, { method: 'POST' })
      }
      if (next === 'planned') {
        const body = patchBodyForPlanned(sprint, Date.now())
        return api(`/admin/sprints/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      if (next === 'finished') {
        const body = patchBodyForFinished(sprint, Date.now())
        return api(`/admin/sprints/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
      }
      throw new Error('Неизвестный статус')
    },
    onSuccess: () => {
      toast.success('Статус спринта обновлён')
      void qc.invalidateQueries({ queryKey: ['admin', 'sprints'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const archiveMutation = useMutation({
    mutationFn: (id) =>
      api(`/admin/sprints/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ archived: true, active: false }),
      }),
    onSuccess: () => {
      toast.success('Спринт в архиве')
      void qc.invalidateQueries({ queryKey: ['admin', 'sprints'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const onTitleChange = (title) => {
    setForm((f) => {
      const next = { ...f, title }
      if (!slugTouched.current) {
        next.slug = slugFromTitle(title)
      }
      return next
    })
  }

  const submitSheet = (e) => {
    e.preventDefault()
    const slug = form.slug.trim() || slugFromTitle(form.title)
    const title = form.title.trim()
    if (!slug || !title) {
      toast.error('Укажите название и короткий адрес спринта')
      return
    }
    const built = buildResourceLinksPayload(resourceLinks)
    if (!built.ok) {
      toast.error(built.message)
      return
    }
    const tabLabel = form.tabLabel.trim() || title
    const tags = parseTags(form.tagsRaw)
    const startsAt = range?.from ? toIsoStartOfDay(range.from) : undefined
    const endsAt = range?.to ? toIsoEndOfDay(range.to) : undefined
    const tabIcon = form.tabIcon.trim() || null
    const briefPayload = { resourceLinks: built.links }

    if (sheetMode === 'create') {
      createMutation.mutate({
        slug,
        title,
        tabLabel,
        tabIcon,
        completedLabel: form.completedLabel.trim() || 'Сдано',
        tags,
        active: form.makeActive,
        published: form.published,
        archived: false,
        brief: briefPayload,
        metrics: {},
        startsAt,
        endsAt,
      })
      return
    }

    if (!editingId) return
    const body = {
      slug,
      title,
      tabLabel,
      completedLabel: form.completedLabel.trim() || 'Сдано',
      tags,
      published: form.published,
      tabIcon,
      startsAt: startsAt ?? null,
      endsAt: endsAt ?? null,
      brief: briefPayload,
    }
    patchMutation.mutate({ id: editingId, body, makeActive: form.makeActive })
  }

  const previewTags = useMemo(() => parseTags(form.tagsRaw), [form.tagsRaw])

  const sprintRowBtn =
    'h-9 min-w-[9rem] justify-center px-2 py-0 text-[10px] font-semibold !rounded-lg font-sans'

  const renderSprintRow = (s, section) => {
    const barVariant = section === 'active' ? 'arena' : section === 'planned' ? 'ongoing' : 'done'
    const arenaButFinished = s.active && section === 'finished'
    return (
      <li
        key={s.id}
        className="flex flex-col gap-3 rounded-xl border border-plantation bg-timber/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-mystic">{s.title}</span>
            {s.active && section !== 'archive' ? (
              <span className="rounded bg-spring/20 px-2 py-0.5 font-mono text-[10px] text-spring">
                Арена
              </span>
            ) : null}
            {arenaButFinished ? (
              <span className="rounded border border-turquoise/30 bg-turquoise/10 px-2 py-0.5 font-mono text-[10px] text-turquoise">
                Завершён по датам
              </span>
            ) : null}
            {s.published === false ? (
              <span className="rounded border border-plantation px-2 py-0.5 font-mono text-[10px] text-gull">
                Черновик
              </span>
            ) : null}
          </div>
          <div className="font-mono text-xs text-gull">{s.slug}</div>
          {s.startsAt || s.endsAt ? (
            <div className="mt-1 text-[10px] text-slate-arena">
              {s.startsAt ? new Date(s.startsAt).toLocaleDateString() : '—'} —{' '}
              {s.endsAt ? new Date(s.endsAt).toLocaleDateString() : '—'}
            </div>
          ) : null}
          {section !== 'archive' ? (
            <SprintTimeBar sprint={s} variant={barVariant} nowMs={nowMs} />
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="sr-only" htmlFor={`sprint-status-${s.id}`}>
            Статус спринта
          </label>
          <select
            id={`sprint-status-${s.id}`}
            className={cn(
              'h-9 min-w-[12.5rem] shrink-0 rounded-lg border border-plantation bg-aztec px-2 font-mono text-[10px] font-semibold text-catskill outline-none focus:border-turquoise/40 focus:ring-1 focus:ring-turquoise/15',
              statusMutation.isPending && statusMutation.variables?.id === s.id && 'opacity-50'
            )}
            value={sprintUiStatus(s, nowMs)}
            disabled={statusMutation.isPending && statusMutation.variables?.id === s.id}
            onChange={(e) => {
              const next = e.target.value
              const cur = sprintUiStatus(s, nowMs)
              if (next === cur) return
              if (next === 'archive') {
                setArchiveConfirm({ id: s.id, title: s.title })
                return
              }
              statusMutation.mutate({ id: s.id, next, sprint: s })
            }}
          >
            <option value="active">Активная арена</option>
            <option value="planned">Запланирован</option>
            <option value="finished">Завершён</option>
            <option value="archive">Архив</option>
          </select>
          <Button
            type="button"
            variant="outline"
            className={sprintRowBtn}
            onClick={() => openEdit(s)}
          >
            Редактировать
          </Button>
          <Button
            type="button"
            variant="outline"
            className={sprintRowBtn}
            disabled={duplicateMutation.isPending}
            onClick={() => duplicateMutation.mutate(s.id)}
          >
            Дублировать
          </Button>
        </div>
      </li>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-bold uppercase tracking-tight text-catskill">
            Спринты
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gull">
            Секции отражают очередь боёв и календарь. Статус (включая архив) — в списке у строки;
            архив подтверждается в диалоге. Редактирование — в боковой панели. Короткий адрес в
            ссылке подставляется из названия; при необходимости поправьте его вручную.
          </p>
        </div>
        <Button variant="gradient" onClick={openCreate}>
          + Новый спринт
        </Button>
      </div>

      {isPending ? (
        <ul className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <li key={i} className="rounded-xl border border-plantation p-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="mt-2 h-4 w-32" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-8">
          <Section title="Активный" subtitle="Текущий бой на арене (не более одного).">
            {groups.activeArena.length === 0 ? (
              <li className="list-none rounded-xl border border-dashed border-plantation px-4 py-6 text-center text-sm text-gull">
                Нет активного спринта — выберите «Активная арена» в списке статуса у нужного спринта
                или отметьте при создании.
              </li>
            ) : (
              groups.activeArena.map((s) => renderSprintRow(s, 'active'))
            )}
          </Section>

          <Section
            title="Запланированные"
            subtitle="Старт ещё впереди или полоска времени не дошла до конца."
          >
            {groups.planned.length === 0 ? (
              <li className="list-none rounded-xl border border-dashed border-plantation px-4 py-6 text-center text-sm text-gull">
                Нет запланированных.
              </li>
            ) : (
              groups.planned.map((s) => renderSprintRow(s, 'planned'))
            )}
          </Section>

          <Section
            title="Завершённые"
            subtitle="Финиш по датам уже прошёл или шкала времени заполнилась до конца."
          >
            {groups.finished.length === 0 ? (
              <li className="list-none rounded-xl border border-dashed border-plantation px-4 py-6 text-center text-sm text-gull">
                Пока пусто.
              </li>
            ) : (
              groups.finished.map((s) => renderSprintRow(s, 'finished'))
            )}
          </Section>

          {groups.archived.length > 0 ? (
            <Section title="Архив" subtitle="Скрыты с публичного сайта, доступны только здесь.">
              {groups.archived.map((s) => renderSprintRow(s, 'archive'))}
            </Section>
          ) : null}
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o)
          if (!o) resetForm()
        }}
      >
        <SheetContent className="max-w-full sm:max-w-xl">
          <SheetHeader
            title={sheetMode === 'create' ? 'Новый спринт' : 'Редактирование'}
            description="Выберите период в календаре одним диапазоном. Черновик скрыт на основном сайте."
          />
          <SheetBody>
            <form className="space-y-4" onSubmit={submitSheet}>
              <div>
                <Label>Название</Label>
                <Input
                  className="mt-1"
                  value={form.title}
                  onChange={(e) => onTitleChange(e.target.value)}
                />
              </div>
              <div>
                <Label>Короткий адрес в ссылке</Label>
                <Input
                  className="mt-1 font-mono text-xs"
                  value={form.slug}
                  onChange={(e) => {
                    slugTouched.current = true
                    setForm((f) => ({ ...f, slug: e.target.value }))
                  }}
                />
                <HintRow className="mt-1.5" icon="link">
                  Латиница без пробелов — часть URL карточки спринта; при вводе названия
                  подставляется автоматически.
                </HintRow>
              </div>
              <div>
                <Label>Подпись вкладки</Label>
                <Input
                  className="mt-1"
                  placeholder="если пусто — как название"
                  value={form.tabLabel}
                  onChange={(e) => setForm((f) => ({ ...f, tabLabel: e.target.value }))}
                />
              </div>
              <div>
                <Label>Значок вкладки</Label>
                <MaterialIconPresetGrid
                  idPrefix="tab-icon"
                  value={
                    RESOURCE_ICON_PRESETS.some((p) => p.value === form.tabIcon.trim())
                      ? form.tabIcon.trim()
                      : ''
                  }
                  onPick={(icon) => setForm((f) => ({ ...f, tabIcon: icon }))}
                />
                <Input
                  className="mt-2 font-mono text-xs"
                  placeholder="Свой код (латиница, подчёркивание)"
                  value={form.tabIcon}
                  onChange={(e) => setForm((f) => ({ ...f, tabIcon: e.target.value }))}
                />
                <HintRow className="mt-1.5" icon="palette">
                  Нажмите на картинку или введите код вручную — тот же набор, что на сайте арены.
                </HintRow>
              </div>
              <div>
                <Label>Метка завершения</Label>
                <Input
                  className="mt-1"
                  value={form.completedLabel}
                  onChange={(e) => setForm((f) => ({ ...f, completedLabel: e.target.value }))}
                />
              </div>
              <div>
                <Label>Теги (через запятую)</Label>
                <Input
                  className="mt-1"
                  placeholder="React, TypeScript"
                  value={form.tagsRaw}
                  onChange={(e) => setForm((f) => ({ ...f, tagsRaw: e.target.value }))}
                />
              </div>

              <div className="space-y-2 rounded-xl border border-plantation bg-timber/20 p-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <Label>Полезные ссылки в брифе</Label>
                    <HintRow className="mt-0.5 max-w-md" icon="list_alt">
                      Подпись, полная ссылка и значок. Порядок строк = порядок чипов у участников.
                      Ссылки только с https:// или http://.
                    </HintRow>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 shrink-0 text-[11px]"
                    onClick={() => setResourceLinks((rows) => [...rows, newResourceLinkRow()])}
                  >
                    + Ссылка
                  </Button>
                </div>
                {resourceLinks.length === 0 ? (
                  <p className="py-2 text-center font-mono text-[11px] text-slate-arena">
                    Пока нет ссылок
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {resourceLinks.map((row, idx) => (
                      <li
                        key={row.id}
                        className="rounded-lg border border-plantation bg-aztec/40 p-3 space-y-2"
                      >
                        <div className="grid gap-2 sm:grid-cols-2">
                          <div>
                            <Label className="text-[10px] text-gull">Подпись</Label>
                            <Input
                              className="mt-1"
                              placeholder="Документация"
                              value={row.label}
                              onChange={(e) => {
                                const v = e.target.value
                                setResourceLinks((rows) =>
                                  rows.map((r) => (r.id === row.id ? { ...r, label: v } : r))
                                )
                              }}
                            />
                          </div>
                          <div>
                            <Label className="text-[10px] text-gull">URL</Label>
                            <Input
                              className="mt-1 font-mono text-xs"
                              placeholder="https://…"
                              value={row.href}
                              onChange={(e) => {
                                const v = e.target.value
                                setResourceLinks((rows) =>
                                  rows.map((r) => (r.id === row.id ? { ...r, href: v } : r))
                                )
                              }}
                            />
                          </div>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                          <div>
                            <Label className="text-[10px] text-gull">Иконка</Label>
                            <MaterialIconPresetGrid
                              idPrefix={`rl-icon-${row.id}`}
                              value={
                                RESOURCE_ICON_PRESETS.some((p) => p.value === row.icon)
                                  ? row.icon
                                  : ''
                              }
                              onPick={(icon) =>
                                setResourceLinks((rows) =>
                                  rows.map((r) => (r.id === row.id ? { ...r, icon } : r))
                                )
                              }
                            />
                            <Input
                              className="mt-2 font-mono text-xs"
                              placeholder="Свой код значка"
                              value={row.icon}
                              onChange={(e) => {
                                const v = e.target.value
                                setResourceLinks((rows) =>
                                  rows.map((r) => (r.id === row.id ? { ...r, icon: v } : r))
                                )
                              }}
                            />
                          </div>
                          <div className="flex flex-wrap gap-1 sm:justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 px-2 text-[11px]"
                              disabled={idx === 0}
                              title="Выше"
                              onClick={() => {
                                if (idx === 0) return
                                setResourceLinks((rows) => {
                                  const next = [...rows]
                                  ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                                  return next
                                })
                              }}
                            >
                              ↑
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 px-2 text-[11px]"
                              disabled={idx >= resourceLinks.length - 1}
                              title="Ниже"
                              onClick={() => {
                                if (idx >= resourceLinks.length - 1) return
                                setResourceLinks((rows) => {
                                  const next = [...rows]
                                  ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
                                  return next
                                })
                              }}
                            >
                              ↓
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-8 px-2 text-[11px] text-red-300/90"
                              onClick={() =>
                                setResourceLinks((rows) => rows.filter((r) => r.id !== row.id))
                              }
                            >
                              Удалить
                            </Button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-plantation bg-timber/20 px-3 py-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-catskill">
                  <Checkbox
                    checked={form.published}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, published: v === true }))}
                  />
                  Опубликован на сайте (если выключить — останется черновиком)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-catskill">
                  <Checkbox
                    checked={form.makeActive}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, makeActive: v === true }))}
                  />
                  Сделать активным боем арены (остальные деактивируются)
                </label>
              </div>

              <div>
                <Label>Период спринта</Label>
                <p className="mt-0.5 text-[10px] text-gull">
                  Выберите дату начала и окончания в одном календаре. Прошлые даты не блокируются —
                  если не выбраны, это просто другой клик, а не ограничение.
                </p>
                <div className="sprint-day-picker-scope mt-2 flex justify-center rounded-xl border border-plantation bg-aztec p-2 text-catskill">
                  <DayPicker
                    mode="range"
                    numberOfMonths={1}
                    selected={range}
                    onSelect={(r) => setRange(r)}
                    className="text-sm"
                  />
                </div>
              </div>

              <SprintPreviewCard
                title={form.title}
                tabLabel={form.tabLabel.trim() || form.title}
                completedLabel={form.completedLabel}
                tags={previewTags}
                tabIcon={form.tabIcon.trim()}
                range={range}
              />

              <div className="flex justify-end gap-2 border-t border-plantation pt-4">
                <Button type="button" variant="outline" onClick={() => setSheetOpen(false)}>
                  Отмена
                </Button>
                <Button
                  type="submit"
                  variant="gradient"
                  disabled={createMutation.isPending || patchMutation.isPending}
                >
                  {sheetMode === 'create' ? 'Создать' : 'Сохранить'}
                </Button>
              </div>
            </form>
          </SheetBody>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={!!archiveConfirm}
        onOpenChange={(o) => !o && !archiveMutation.isPending && setArchiveConfirm(null)}
        title="Убрать спринт в архив?"
        description={
          archiveConfirm
            ? `Спринт «${archiveConfirm.title}» скроется на публичном сайте и останется доступен только в этой админке.`
            : ''
        }
        cancelLabel="Отмена"
        confirmLabel="В архив"
        confirmVariant="danger"
        isPending={archiveMutation.isPending}
        onConfirm={() => {
          if (!archiveConfirm) return
          archiveMutation.mutate(archiveConfirm.id, {
            onSuccess: () => setArchiveConfirm(null),
          })
        }}
      />
    </div>
  )
}
