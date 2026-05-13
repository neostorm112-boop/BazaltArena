import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
import { deleteSolutionLike, getHall, putSolutionLike } from '../api/basaltApi.js'
import { useAuth } from '../auth/useAuth.js'
import { queryKeys } from '../lib/queryKeys.js'
import { AppFooter } from '../components/layout/AppFooter.jsx'
import { AppHeader } from '../components/layout/AppHeader.jsx'
import { SprintBriefModal } from '../components/main/SprintBriefModal.jsx'
import { MaterialIcon } from '../components/ui/MaterialIcon.jsx'

function dicebearAvatar(seed) {
  const q = new URLSearchParams({
    seed: String(seed),
    scale: '62',
    radius: '12',
  })
  return `https://api.dicebear.com/7.x/identicon/svg?${q.toString()}`
}

function rankBadgeClasses(badge) {
  switch (badge) {
    case 'gold':
      return 'bg-[#EAB308] text-aztec shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]'
    case 'slate':
      return 'bg-fiord text-white shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]'
    case 'bronze':
      return 'bg-[#9A3412] text-[#FFEDD5] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]'
    default:
      return 'bg-[#334155] text-catskill shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1)]'
  }
}

function SolutionCard({ solution, isWinner, onLikeClick, likePending }) {
  const s = solution
  const rank = s.rank
  const badge = s.rankBadge ?? 'muted'
  const likedByMe = !!s.likedByMe

  return (
    <article
      className={[
        'group relative isolate overflow-hidden rounded-xl border bg-timber p-5 max-[360px]:p-4 md:p-6 transition-[border-color] duration-150 ease-out',
        isWinner
          ? 'border border-[rgba(234,179,8,0.35)]'
          : 'border border-plantation hover:border-fiord',
      ].join(' ')}
    >
      <div className="relative z-[1] flex flex-col gap-6 max-[360px]:gap-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex min-w-0 items-center gap-5 max-[360px]:gap-3">
          <div className="relative shrink-0">
            <div
              className={[
                'flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-aztec max-[360px]:size-14',
                isWinner
                  ? 'border border-[rgba(234,179,8,0.4)]'
                  : 'border border-plantation transition-colors duration-150 group-hover:border-fiord',
              ].join(' ')}
            >
              <img
                src={
                  typeof s.avatarUrl === 'string' && s.avatarUrl
                    ? s.avatarUrl
                    : dicebearAvatar(s.avatarSeed ?? s.handle)
                }
                alt=""
                className="h-full w-full object-contain"
                decoding="async"
                draggable={false}
              />
            </div>
            <div
              className={`absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-md font-mono text-xs font-extrabold ${rankBadgeClasses(badge)}`}
            >
              {rank}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <h3
              className={[
                'flex flex-wrap items-center gap-2 font-bold',
                rank === 1
                  ? 'text-xl leading-7 text-white max-[360px]:text-lg md:text-xl md:leading-7'
                  : 'text-lg leading-7 text-mystic max-[360px]:text-base',
              ].join(' ')}
            >
              <span className={rank === 1 ? 'text-white' : 'text-mystic'}>{s.displayName}</span>
              {s.showCrown ? (
                <MaterialIcon name="workspace_premium" size={18} className="text-[#EAB308]" />
              ) : null}
            </h3>
            <div className="flex flex-wrap items-center gap-3 font-mono text-sm leading-5 max-[360px]:gap-2 max-[360px]:text-xs">
              <span className="text-catskill">{s.dateLabel}</span>
              <span
                className={`size-1 shrink-0 rounded-full ${rank === 1 ? 'bg-fiord' : 'bg-[#334155]'}`}
                aria-hidden
              />
              <span className="font-mono text-[#FACC15]">Оценка наставника: {s.mentorScore}</span>
            </div>
            <a className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs text-turquoise hover:underline">
              <MaterialIcon name="send" size={12} opticalSize={12} className="text-turquoise" />@
              {s.handle}
            </a>
          </div>
        </div>

        <div
          className={[
            'flex w-full flex-shrink-0 flex-wrap items-center justify-between gap-3 max-[360px]:gap-2 md:w-auto md:justify-end',
            rank > 1 ? 'opacity-60 transition-opacity duration-200 group-hover:opacity-100' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <div
            className={[
              'flex items-center rounded-lg border border-plantation bg-aztec/50 p-1 transition-[border-color,background-color] duration-200',
              isWinner ? '' : 'group-hover:border-white/30 group-hover:bg-plantation/70',
            ].join(' ')}
          >
            <a
              href={s.codeUrl}
              target="_blank"
              rel="noreferrer"
              className={[
                'group flex items-center gap-2 rounded py-1.5 text-gull transition-[background-color,color,box-shadow] duration-200 max-[360px]:gap-1',
                isWinner ? 'px-3' : 'px-2',
                isWinner
                  ? 'hover:bg-white/5 hover:text-turquoise'
                  : 'group-hover:text-white hover:text-turquoise',
              ].join(' ')}
              title="Код"
            >
              <MaterialIcon name="code" size={18} />
              <span
                className={['font-mono text-xs font-bold', isWinner ? 'inline' : 'hidden'].join(
                  ' '
                )}
              >
                КОД
              </span>
            </a>
            <div className="mx-1 h-4 w-px bg-plantation" aria-hidden />
            <a
              href={s.demoUrl}
              target="_blank"
              rel="noreferrer"
              className={[
                'group/demo flex items-center gap-2 rounded py-1.5 text-gull transition-[background-color,color,box-shadow] duration-200 max-[360px]:gap-1',
                isWinner ? 'px-3' : 'px-2',
                isWinner
                  ? 'hover:bg-white/5 hover:text-turquoise'
                  : 'group-hover:text-white hover:text-turquoise',
              ].join(' ')}
              title="Демо"
            >
              <MaterialIcon name="rocket_launch" size={18} />
              <span
                className={['font-mono text-xs font-bold', isWinner ? 'inline' : 'hidden'].join(
                  ' '
                )}
              >
                ДЕМО
              </span>
            </a>
          </div>

          <button
            type="button"
            aria-pressed={likedByMe}
            aria-label={likedByMe ? 'Убрать лайк' : 'Поставить лайк'}
            disabled={likePending}
            onClick={onLikeClick}
            className={[
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 font-mono text-sm font-bold transition max-[360px]:px-2 max-[360px]:py-1.5 max-[360px]:text-xs',
              likedByMe
                ? 'border-turquoise/30 bg-turquoise/15 text-half-baked hover:border-turquoise/50 hover:bg-turquoise/20'
                : 'border-plantation bg-aztec text-gull hover:border-fiord hover:text-catskill',
              likePending ? 'pointer-events-none opacity-60' : '',
            ].join(' ')}
          >
            <MaterialIcon name="favorite" size={18} className={likedByMe ? 'text-turquoise' : ''} />
            {s.likes}
          </button>
        </div>
      </div>
    </article>
  )
}

function SprintMetrics({ metrics }) {
  const m = metrics
  const pct = Math.min(100, Math.max(0, Number(m.submissionsBarPct) || 0))

  return (
    <div className="space-y-4">
      <h3 className="font-mono text-xs font-bold uppercase tracking-[1.2px] text-slate-arena">
        Метрики спринта
      </h3>
      <div className="space-y-4 max-[360px]:space-y-3">
        <div className="flex flex-col gap-2 rounded-xl border border-plantation bg-timber px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] max-[360px]:px-4 max-[360px]:py-4">
          <div className="flex items-start justify-between gap-4">
            <span className="font-sans text-xs font-medium leading-4 text-gull">
              Всего отправок
            </span>
            <MaterialIcon name="dataset" size={18} opticalSize={18} className="text-gull" />
          </div>
          <p className="font-mono text-[30px] font-extrabold leading-9 text-white max-[360px]:text-[26px] max-[360px]:leading-8">
            {Number(m.submissions)
              .toLocaleString('ru-RU')
              .replace(/\u00a0/g, ' ')}
          </p>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#1E293B]">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-turquoise"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="flex items-center gap-1 font-mono text-[10px] leading-[15px] text-[#4ADE80]">
            <MaterialIcon name="trending_up" size={12} className="text-[#4ADE80]" />
            {m.deltaLabel}
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-plantation bg-timber px-5 py-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] max-[360px]:px-4 max-[360px]:py-4">
          <div className="flex items-start justify-between gap-4">
            <span className="font-sans text-xs font-medium leading-4 text-gull">Доля успешных</span>
            <MaterialIcon name="check_circle" size={18} opticalSize={18} className="text-gull" />
          </div>
          <p className="font-mono text-[30px] font-extrabold leading-9 text-white max-[360px]:text-[26px] max-[360px]:leading-8">
            {m.successRate}
          </p>
          <div className="flex items-center gap-2 rounded-lg bg-[rgba(30,41,59,0.5)] px-2 py-2">
            <span className="size-2 shrink-0 rounded-full bg-[#0BDA54]" aria-hidden />
            <span className="font-mono text-[10px] uppercase leading-[15px] tracking-[0.5px] text-gull">
              {m.verifiedSolutions} проверенных решений
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PastWinners({ winners }) {
  return (
    <div className="space-y-4">
      <h3 className="font-mono text-xs font-bold uppercase tracking-[1.2px] text-slate-arena">
        Победители прошлых спринтов
      </h3>
      <div className="overflow-hidden rounded-xl border border-plantation bg-timber">
        {winners.map((w, i) => (
          <div
            key={`${w.sprintRank}-${w.handle}`}
            className={[
              'group flex items-center gap-4 px-4 py-4 transition-colors duration-150 ease-out max-[360px]:gap-3 max-[360px]:px-3 max-[360px]:py-3 hover:bg-white/[0.02]',
              i > 0 ? 'border-t border-plantation' : '',
            ].join(' ')}
          >
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-plantation bg-[#1E293B] font-mono text-xs font-bold text-gull transition-[border-color,color,background-color] duration-300 group-hover:border-turquoise/70 group-hover:bg-turquoise/10 group-hover:text-turquoise">
              {w.sprintRank}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-mystic transition-colors duration-300 group-hover:text-white">
                {w.title}
              </p>
              <p className="font-mono text-xs text-turquoise">@{w.handle}</p>
            </div>
            <MaterialIcon
              name="chevron_right"
              size={18}
              className="shrink-0 text-fiord transition-[transform,color] duration-300 group-hover:translate-x-0.5 group-hover:text-gull"
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function QuoteCard({ quote }) {
  return (
    <div className="relative isolate overflow-hidden rounded-xl border border-turquoise/20 bg-gradient-to-r from-turquoise/10 to-transparent px-5 pb-5 pt-[19px]">
      <MaterialIcon
        name="format_quote"
        size={96}
        className="pointer-events-none absolute -bottom-4 -right-1 rotate-12 text-turquoise/[0.05]"
      />
      <p className="relative z-[1] text-[11.4px] font-medium leading-5 text-catskill">
        {quote.text}
      </p>
      <div className="relative z-[2] mt-3 flex items-center gap-2">
        <div className="size-5 shrink-0 rounded-full bg-[#334155]" aria-hidden />
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.25px] text-turquoise">
          {quote.attribution}
        </p>
      </div>
    </div>
  )
}

const HALL_SORT_OPTIONS = [
  { id: 'efficiency', label: 'Эффективность' },
  { id: 'likes', label: 'Лайки' },
  { id: 'mentor', label: 'Оценки' },
]

function HallSortDropdown({ value, onChange }) {
  const listboxId = useId()
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)

  const selected = HALL_SORT_OPTIONS.find((o) => o.id === value) ?? HALL_SORT_OPTIONS[0]

  useEffect(() => {
    if (!open) return
    const i = HALL_SORT_OPTIONS.findIndex((o) => o.id === value)
    setHighlight(i >= 0 ? i : 0)
  }, [open, value])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (!rootRef.current?.contains(e.target)) return
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        triggerRef.current?.focus()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlight((h) => (h + 1) % HALL_SORT_OPTIONS.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlight((h) => (h - 1 + HALL_SORT_OPTIONS.length) % HALL_SORT_OPTIONS.length)
        return
      }
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        const opt = HALL_SORT_OPTIONS[highlight]
        if (opt) {
          onChange(opt.id)
          setOpen(false)
          triggerRef.current?.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, highlight, onChange])

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 font-mono text-[10px] uppercase tracking-[1.2px] max-[360px]:text-[9px]">
      <span className="shrink-0 text-slate-arena">СОРТИРОВКА:</span>
      <div className="relative shrink-0" ref={rootRef}>
        <button
          ref={triggerRef}
          type="button"
          id={`${listboxId}-trigger`}
          className="flex min-w-[11rem] items-center justify-between gap-2 rounded-lg border border-turquoise/50 bg-turquoise/15 px-3 py-2 text-left font-bold text-catskill outline-none ring-turquoise/30 transition hover:bg-turquoise/20 focus-visible:ring-2 max-[360px]:min-w-[11rem] max-[360px]:py-1.5"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={listboxId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="truncate">{selected.label}</span>
          <MaterialIcon
            name="expand_more"
            size={18}
            opticalSize={18}
            className={`shrink-0 text-turquoise transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
            aria-hidden
          />
        </button>
        {open ? (
          <div
            id={listboxId}
            role="listbox"
            aria-labelledby={`${listboxId}-trigger`}
            className="absolute right-0 top-[calc(100%+0.25rem)] z-[25] min-w-[11rem] overflow-hidden rounded-lg border border-plantation bg-timber py-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] max-[360px]:left-0 max-[360px]:right-0 max-[360px]:min-w-0"
          >
            {HALL_SORT_OPTIONS.map((opt, i) => {
              const isSelected = opt.id === value
              const isHi = i === highlight
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    'flex w-full items-center px-3 py-2.5 text-left font-mono text-[10px] font-semibold uppercase tracking-[1px] transition max-[360px]:py-2',
                    isHi ? 'bg-turquoise/10 text-catskill' : 'text-gull',
                    isSelected
                      ? 'border-l-[3px] border-l-turquoise pl-[calc(0.75rem-3px)]'
                      : 'border-l-[3px] border-l-transparent',
                  ].join(' ')}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => {
                    onChange(opt.id)
                    setOpen(false)
                    triggerRef.current?.focus()
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function hallSprintCalendarLabel(sprint) {
  if (!sprint) return '—'
  if (sprint.arenaActive) return 'Активный спринт'
  if (sprint.endsAt) {
    const endMs = new Date(sprint.endsAt).getTime()
    if (endMs >= Date.now()) {
      return `До ${new Date(sprint.endsAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
    }
    return `Завершён ${new Date(sprint.endsAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
  }
  return sprint.completedLabel || '—'
}

export function HallOfFamePage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [hallSort, setHallSort] = useState('efficiency')
  const [loadMoreClicked, setLoadMoreClicked] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [likeError, setLikeError] = useState(null)

  const likeMutation = useMutation({
    mutationFn: async ({ id, liked }) => {
      if (liked) return deleteSolutionLike(id)
      return putSolutionLike(id)
    },
    onSuccess: () => {
      setLikeError(null)
      void qc.invalidateQueries({ queryKey: ['hall'] })
    },
    onError: (e) => {
      setLikeError(e instanceof Error ? e.message : 'Не удалось изменить лайк')
    },
  })

  const {
    data,
    isPending: loading,
    isError,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.hall(hallSort),
    queryFn: () => getHall(hallSort),
    staleTime: 0,
    refetchOnWindowFocus: true,
  })

  const error = isError
    ? queryError instanceof Error
      ? queryError.message
      : 'Ошибка загрузки'
    : null

  /** API отдаёт уже отфильтрованный список: арена первая, далее завершённые с решениями. В UI показываем только первый. */
  const activeSprint = data?.sprints?.[0] ?? null

  const solutionsList = activeSprint?.solutions ?? []

  if (!user) return null

  const page = data?.page

  return (
    <div className="flex min-h-screen flex-col bg-aztec">
      <AppHeader />
      <main className="flex-1 px-0 pt-[73px]">
        <div className="mx-auto max-w-[1400px] px-6 py-10 max-[360px]:px-3 max-[360px]:py-6 md:px-10">
          {loading ? (
            <p className="font-mono text-sm text-gull">Загрузка зала славы…</p>
          ) : error ? (
            <div className="rounded-xl border border-plantation bg-timber/60 px-6 py-8 text-center">
              <p className="text-gull">{error}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-8 max-[360px]:gap-6">
              {likeError ? (
                <div
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 font-mono text-sm text-red-200"
                >
                  {likeError}
                </div>
              ) : null}
              <header className="flex flex-col gap-3">
                <div className="inline-flex w-fit max-w-full items-center gap-2 rounded-full border border-turquoise/10 bg-turquoise/5 px-3 py-1">
                  {page?.breadcrumbs?.map((crumb, i) => (
                    <span key={crumb.label} className="flex items-center gap-2">
                      {i > 0 ? (
                        <MaterialIcon name="chevron_right" size={10} className="text-turquoise" />
                      ) : null}
                      <span
                        className={`font-mono text-xs leading-4 text-turquoise ${crumb.muted ? 'opacity-70' : 'font-bold'}`}
                      >
                        {crumb.label}
                      </span>
                    </span>
                  ))}
                </div>
                <h1 className="text-[30px] font-bold leading-9 tracking-[-0.75px] text-white max-[360px]:text-[22px] max-[360px]:leading-7 md:text-[48px] md:leading-[48px] md:tracking-[-1.2px]">
                  {page?.title}
                </h1>
                <p className="max-w-[768px] pt-1 text-lg leading-[29px] text-gull max-[360px]:text-sm max-[360px]:leading-6">
                  {page?.description}
                </p>
              </header>

              {activeSprint ? (
                <section className="relative isolate overflow-hidden rounded-xl border border-plantation bg-timber px-6 pb-6 pt-8 max-[360px]:px-4 max-[360px]:pb-4 max-[360px]:pt-5 md:px-6 md:pb-6 md:pt-8 lg:px-8 lg:pb-8 lg:pt-10">
                  <div className="relative z-[1] flex flex-col gap-6 max-[360px]:gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-4 max-[360px]:space-y-3">
                      <h2 className="text-2xl font-bold leading-8 text-white max-[360px]:text-xl max-[360px]:leading-7 md:text-[30px] md:leading-9">
                        {activeSprint.heroTitle}
                      </h2>
                      <div className="flex flex-wrap items-center gap-2">
                        {activeSprint.tags?.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md border border-[#334155] bg-aztec px-2.5 py-1 font-mono text-xs text-catskill max-[360px]:text-[11px]"
                          >
                            {tag}
                          </span>
                        ))}
                        <span className="flex items-center gap-1 rounded-md border border-[#334155] bg-aztec px-2.5 py-1 font-mono text-xs text-gull max-[360px]:text-[11px]">
                          <MaterialIcon name="event" size={12} className="text-gull" />
                          {hallSprintCalendarLabel(activeSprint)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBriefOpen(true)}
                      className="inline-flex h-11 w-[174px] shrink-0 items-center justify-center gap-2 self-start rounded-lg bg-turquoise px-5 text-sm font-semibold leading-5 text-white transition-colors duration-150 hover:bg-[#6d4ef0] max-[360px]:w-full lg:self-end"
                    >
                      <MaterialIcon name="description" size={16} className="text-white" />
                      Открыть бриф
                    </button>
                  </div>
                </section>
              ) : null}

              <div className="grid grid-cols-1 gap-8 max-[360px]:gap-6 xl:grid-cols-[minmax(0,1fr)_418px] xl:items-start">
                <div className="flex min-w-0 flex-col gap-4">
                  {activeSprint ? (
                    <>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                        <h2 className="text-lg font-bold leading-7 text-catskill">
                          Лучшие решения
                        </h2>
                        <HallSortDropdown value={hallSort} onChange={setHallSort} />
                      </div>

                      {solutionsList.length === 0 ? (
                        <p className="rounded-xl border border-plantation bg-timber/50 px-6 py-10 text-center text-gull">
                          Для этого спринта пока нет решений в архиве.
                        </p>
                      ) : (
                        solutionsList.map((sol) => (
                          <SolutionCard
                            key={sol.id}
                            solution={sol}
                            isWinner={sol.rank === 1}
                            likePending={
                              likeMutation.isPending && likeMutation.variables?.id === sol.id
                            }
                            onLikeClick={() =>
                              likeMutation.mutate({ id: sol.id, liked: !!sol.likedByMe })
                            }
                          />
                        ))
                      )}

                      {data?.loadMoreRemaining > 0 && solutionsList.length > 0 ? (
                        <div className="flex justify-center pt-6">
                          <button
                            type="button"
                            onClick={() => setLoadMoreClicked(true)}
                            disabled={loadMoreClicked}
                            className="inline-flex items-center gap-2 font-mono text-sm uppercase tracking-[1.4px] text-slate-arena transition hover:text-gull disabled:opacity-50"
                          >
                            {loadMoreClicked
                              ? 'Пагинация появится в API'
                              : `Загрузить ещё ${data.loadMoreRemaining} решений`}
                            <MaterialIcon name="expand_more" size={18} />
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="rounded-xl border border-plantation bg-timber/50 px-6 py-12 text-center text-gull">
                      Сейчас нет активной арены и завершённых спринтов с решениями — зал славы пуст.
                    </p>
                  )}
                </div>

                <aside className="flex min-w-0 flex-col gap-8">
                  {activeSprint?.metrics ? <SprintMetrics metrics={activeSprint.metrics} /> : null}
                  {data?.pastWinners?.length ? <PastWinners winners={data.pastWinners} /> : null}
                  {data?.quote ? <QuoteCard quote={data.quote} /> : null}
                </aside>
              </div>
            </div>
          )}
        </div>
      </main>
      <SprintBriefModal
        open={briefOpen}
        onClose={() => setBriefOpen(false)}
        sprint={activeSprint}
      />
      <AppFooter />
    </div>
  )
}
