import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api.js'
import { Button } from '../components/ui/button.jsx'
import { Checkbox } from '../components/ui/checkbox.jsx'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../components/ui/dialog.jsx'
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
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs.jsx'
import { Textarea } from '../components/ui/textarea.jsx'
import { useAdminTable } from '../hooks/useAdminTable.js'
import { cn } from '../lib/cn.js'
import { submissionStatusLabel } from '../lib/copy.js'

const columnHelper = createColumnHelper()

const STATUS_TAB = /** @type {const} */ ({
  pending: 'PENDING',
  reviewed: 'REVIEWED',
  accepted: 'ACCEPTED',
  rejected: 'REJECTED',
})

const previewLinkPrimaryClass =
  'inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-[#5b3fd4] via-turquoise to-[#9d7cff] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-turquoise/20 hover:brightness-110 active:scale-[0.99]'
const previewLinkOutlineClass =
  'inline-flex items-center justify-center rounded-xl border border-plantation bg-timber/40 px-4 py-2 font-mono text-xs font-semibold text-catskill hover:border-turquoise/50 hover:bg-white/[0.04]'

/** Для массовой публикации в зал — только черновики очереди проверки. */
function rowEligibleForBatchAccept(row) {
  return row.status === 'PENDING' || row.status === 'REVIEWED'
}

/** Подпись кнопки открытия карточки (не «Оценить» для финальных статусов). */
function reviewOpenButtonLabel(status) {
  switch (status) {
    case 'ACCEPTED':
    case 'REJECTED':
      return 'Карточка'
    default:
      return 'Проверить'
  }
}

/** @param {string} status */
function submissionStatusBadgeClass(status) {
  const base =
    'inline-flex max-w-full items-center rounded-full border px-2 py-0.5 font-sans text-[10px] font-semibold uppercase tracking-wide'
  switch (status) {
    case 'PENDING':
      return cn(base, 'border-amber-500/45 bg-amber-500/15 text-amber-100')
    case 'REVIEWED':
      return cn(base, 'border-sky-500/45 bg-sky-500/15 text-sky-100')
    case 'ACCEPTED':
      return cn(base, 'border-emerald-500/45 bg-emerald-500/15 text-emerald-100')
    case 'REJECTED':
      return cn(base, 'border-rose-500/45 bg-rose-500/15 text-rose-100')
    default:
      return cn(base, 'border-plantation bg-aztec text-gull')
  }
}

async function patchSubmission(id, body) {
  return api(`/admin/submissions/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function SubmissionsPage() {
  const qc = useQueryClient()
  const tableState = useAdminTable({ pageSize: 25, withRowSelection: true })
  const {
    pageIndex,
    pageSize,
    pageOffset,
    rowSelection,
    setRowSelection,
    clearSelection,
    pageCount,
  } = tableState
  /** @type {keyof typeof STATUS_TAB} */
  const [statusTab, setStatusTab] = useState('pending')
  const [review, setReview] = useState(null)
  const [score, setScore] = useState(0)
  const [status, setStatus] = useState('REVIEWED')
  const [mentorComment, setMentorComment] = useState('')
  const [iframeBlocked, setIframeBlocked] = useState(false)

  const statusQuery = STATUS_TAB[statusTab]

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'submissions', { statusTab, pageIndex, pageSize }],
    queryFn: () => {
      const q = new URLSearchParams({
        take: String(pageSize),
        skip: String(pageOffset),
        status: statusQuery,
      })
      return api(`/admin/submissions?${q.toString()}`)
    },
    placeholderData: keepPreviousData,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = pageCount(total)

  const patchMut = useMutation({
    mutationFn: ({ id, body }) => patchSubmission(id, body),
    onSuccess: () => {
      toast.success('Решение обновлено')
      void qc.invalidateQueries({ queryKey: ['admin', 'submissions'] })
      setReview(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const batchMut = useMutation({
    mutationFn: (ids) =>
      api('/admin/submissions/batch-accept', { method: 'POST', body: JSON.stringify({ ids }) }),
    onSuccess: (res) => {
      toast.success(`В зал славы: ${res.updated ?? 0} решений`, {
        description: 'Статус «принято», 100 баллов',
      })
      clearSelection()
      void qc.invalidateQueries({ queryKey: ['admin', 'submissions'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const openReview = (s) => {
    setReview(s)
    setScore(s.mentorScore ?? 0)
    setStatus(s.status ?? 'REVIEWED')
    setMentorComment(s.mentorComment ?? '')
    setIframeBlocked(false)
  }

  const normalizedMentorComment = () => {
    const t = mentorComment.trim()
    return t === '' ? null : t
  }

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table }) => {
          const anySelectable = table.getRowModel().rows.some((r) => r.getCanSelect())
          return (
            <Checkbox
              checked={
                table.getIsAllPageRowsSelected()
                  ? true
                  : table.getIsSomePageRowsSelected()
                    ? 'indeterminate'
                    : false
              }
              disabled={!anySelectable}
              title={
                anySelectable
                  ? 'Выбрать все подходящие для публикации в зал славы'
                  : 'На этой странице нет строк для массовой публикации'
              }
              onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
              aria-label="Выбрать все"
            />
          )
        },
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} role="presentation">
            <Checkbox
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              title={
                row.getCanSelect()
                  ? 'Добавить в выбор для публикации в зал славы'
                  : 'Массовая публикация только для «ожидает проверки» и «проверено»'
              }
              onCheckedChange={(v) => row.toggleSelected(!!v)}
              aria-label="Выбрать"
            />
          </div>
        ),
      }),
      columnHelper.accessor((row) => row.sprint?.title, { id: 'sprint', header: 'Спринт' }),
      columnHelper.accessor((row) => row.user?.handle, {
        id: 'user',
        header: 'Участник',
        cell: (info) => <span className="font-mono text-xs text-turquoise">{info.getValue()}</span>,
      }),
      columnHelper.accessor('mentorScore', { header: 'Оценка' }),
      columnHelper.accessor('status', {
        header: 'Статус',
        cell: (info) => {
          const v = info.getValue()
          return (
            <span className={submissionStatusBadgeClass(v)} title={submissionStatusLabel(v)}>
              {submissionStatusLabel(v)}
            </span>
          )
        },
      }),
      columnHelper.display({
        id: 'act',
        header: '',
        cell: ({ row }) => {
          const st = row.original.status
          return (
            <Button
              variant="gradient"
              className="py-1 text-[10px]"
              onClick={() => openReview(row.original)}
            >
              {reviewOpenButtonLabel(st)}
            </Button>
          )
        },
      }),
    ],
    []
  )

  const table = useReactTable({
    data: items,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: (row) => rowEligibleForBatchAccept(row.original),
  })

  const selectedIds = table.getSelectedRowModel().rows.map((r) => r.original.id)
  const originalStatus = review?.status
  const canQuickPublishHall = originalStatus !== 'ACCEPTED'
  const canQuickRework = originalStatus !== 'PENDING'
  const canQuickReject = originalStatus !== 'REJECTED'
  const previewUrl = review?.demoUrl || review?.repoUrl || ''
  const canFrame = typeof previewUrl === 'string' && previewUrl.startsWith('http')
  const showIframe = canFrame && !iframeBlocked
  const hasRepo = typeof review?.repoUrl === 'string' && review.repoUrl.trim().length > 0
  const hasDemo = typeof review?.demoUrl === 'string' && review.demoUrl.trim().length > 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold uppercase tracking-tight text-catskill">
          Решения
        </h1>
        <p className="mt-2 text-sm text-gull">
          Фильтры по статусу, карточка проверки с превью и комментарием. Массовая публикация —
          только для работ в очереди (ожидают проверки / проверено).
        </p>
        <HintRow className="mt-2 max-w-2xl" icon="grading">
          Оценка и статус сохраняются отдельной кнопкой; быстрые кнопки сверху подставляют типовые
          сочетания.
        </HintRow>
      </div>

      <Tabs
        value={statusTab}
        onValueChange={(v) => {
          if (v === 'pending' || v === 'reviewed' || v === 'accepted' || v === 'rejected') {
            setStatusTab(v)
            tableState.setPageIndex(0)
            clearSelection()
          }
        }}
      >
        <TabsList className="flex h-auto min-h-10 flex-wrap gap-1">
          <TabsTrigger value="pending" className="flex-none">
            Ожидают проверки
          </TabsTrigger>
          <TabsTrigger value="reviewed" className="flex-none">
            Проверено
          </TabsTrigger>
          <TabsTrigger value="accepted" className="flex-none">
            Принятые
          </TabsTrigger>
          <TabsTrigger value="rejected" className="flex-none">
            Отклонённые
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-turquoise/30 bg-turquoise/5 px-4 py-3">
          <span className="font-mono text-xs">Выбрано: {selectedIds.length}</span>
          <Button
            variant="gradient"
            className="py-2"
            disabled={batchMut.isPending}
            title="Только для статусов «ожидает проверки» и «проверено»"
            onClick={() => batchMut.mutate(selectedIds)}
          >
            Опубликовать в Зал славы
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-2xl border border-plantation">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-plantation bg-aztec/80 font-mono text-[10px] uppercase text-slate-arena">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="p-3">
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isPending
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-plantation/40">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="p-3">
                        <Skeleton className="h-4 w-full max-w-[120px]" />
                      </td>
                    ))}
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="border-b border-plantation/40 hover:bg-white/[0.02]">
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-gull">
          Стр. {pageIndex + 1} / {totalPages} · всего решений: {total}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex items-center gap-1 py-2"
            disabled={pageIndex <= 0}
            onClick={() => tableState.setPageIndex((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" /> Назад
          </Button>
          <Button
            variant="outline"
            className="flex items-center gap-1 py-2"
            disabled={pageIndex + 1 >= totalPages}
            onClick={() => tableState.setPageIndex((p) => p + 1)}
          >
            Вперёд <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden p-0">
          <div className="border-b border-plantation px-6 py-4">
            <DialogTitle>
              {originalStatus === 'ACCEPTED' || originalStatus === 'REJECTED'
                ? 'Карточка решения'
                : 'Проверка решения'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Форма оценки, статус и превью работы участника.
            </DialogDescription>
            {review ? (
              <div className="mt-1 space-y-1">
                <p className="text-xs text-gull">
                  {review.sprint?.title} · @{review.user?.handle}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-wide text-slate-arena">
                  Статус: {submissionStatusLabel(originalStatus)}
                </p>
                {originalStatus === 'REJECTED' ? (
                  <p className="text-xs text-gull">
                    Решение отклонено — повторно отклонять не нужно; можно вернуть в очередь или
                    изменить оценку.
                  </p>
                ) : null}
                {originalStatus === 'ACCEPTED' ? (
                  <p className="text-xs text-gull">
                    Уже в зале славы — повторная публикация не требуется.
                  </p>
                ) : null}
                {originalStatus === 'PENDING' ? (
                  <p className="text-xs text-gull">
                    В очереди на проверку — кнопка «На доработку» недоступна, пока статус не
                    изменится.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
          {review ? (
            <div className="grid max-h-[calc(92vh-5rem)] md:grid-cols-2">
              <div className="flex min-h-[320px] flex-col border-plantation md:border-r">
                <div className="flex flex-wrap gap-2 border-b border-plantation p-3">
                  {review.demoUrl ? (
                    <a
                      href={review.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-plantation px-3 py-1.5 text-xs text-turquoise hover:bg-white/5"
                    >
                      Демо <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {review.repoUrl ? (
                    <a
                      href={review.repoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg border border-plantation px-3 py-1.5 text-xs text-turquoise hover:bg-white/5"
                    >
                      Репозиторий <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
                <div className="relative flex min-h-[280px] flex-1 flex-col bg-black/40">
                  {showIframe ? (
                    <iframe
                      title="preview"
                      src={previewUrl}
                      className="h-full min-h-[200px] w-full flex-1 border-0"
                      sandbox="allow-scripts allow-same-origin allow-forms"
                      onError={() => setIframeBlocked(true)}
                    />
                  ) : null}
                  {!showIframe ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                      <p className="max-w-sm text-sm text-gull">
                        Если сайт не отображается здесь, используйте кнопки ниже.
                      </p>
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        {hasDemo ? (
                          <a
                            href={review.demoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={previewLinkPrimaryClass}
                          >
                            Открыть демо в новом окне
                          </a>
                        ) : null}
                        {hasRepo ? (
                          <a
                            href={review.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={previewLinkOutlineClass}
                          >
                            Открыть репозиторий
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <div className="border-t border-plantation/60 p-3">
                      <div className="flex flex-wrap gap-2">
                        {hasDemo ? (
                          <a
                            href={review.demoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={previewLinkPrimaryClass}
                          >
                            Открыть демо в новом окне
                          </a>
                        ) : null}
                        {hasRepo ? (
                          <a
                            href={review.repoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className={previewLinkOutlineClass}
                          >
                            Открыть репозиторий
                          </a>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-4 overflow-y-auto p-6">
                <div>
                  <Label>Баллы (0–100)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    className="mt-1"
                    value={score}
                    onChange={(e) => setScore(Number(e.target.value))}
                  />
                  <HintRow className="mt-1.5" icon="stars">
                    Итоговая оценка видна участнику в истории спринта вместе с комментарием.
                  </HintRow>
                </div>
                <div>
                  <Label>Статус</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Статус" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PENDING">{submissionStatusLabel('PENDING')}</SelectItem>
                      <SelectItem value="REVIEWED">{submissionStatusLabel('REVIEWED')}</SelectItem>
                      <SelectItem value="ACCEPTED">{submissionStatusLabel('ACCEPTED')}</SelectItem>
                      <SelectItem value="REJECTED">{submissionStatusLabel('REJECTED')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Комментарий наставника</Label>
                  <Textarea
                    className="mt-1 min-h-[160px]"
                    value={mentorComment}
                    onChange={(e) => setMentorComment(e.target.value)}
                    placeholder="Обратная связь для участника (видна в истории спринтов)"
                    maxLength={8000}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="gradient"
                    className="flex-1 py-2 text-[10px]"
                    disabled={!canQuickPublishHall || patchMut.isPending}
                    title={
                      canQuickPublishHall
                        ? 'Принять в зал славы (100 баллов)'
                        : 'Уже опубликовано в зале славы'
                    }
                    onClick={() =>
                      patchMut.mutate({
                        id: review.id,
                        body: {
                          mentorScore: 100,
                          status: 'ACCEPTED',
                          mentorComment: normalizedMentorComment(),
                        },
                      })
                    }
                  >
                    Опубликовать в Зал славы
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 py-2 text-[10px]"
                    disabled={!canQuickRework || patchMut.isPending}
                    title={
                      canQuickRework
                        ? 'Вернуть в очередь проверки'
                        : 'Уже в очереди на проверку — сначала измените статус или сохраните оценку'
                    }
                    onClick={() =>
                      patchMut.mutate({
                        id: review.id,
                        body: {
                          status: 'PENDING',
                          mentorScore: 0,
                          mentorComment: normalizedMentorComment(),
                        },
                      })
                    }
                  >
                    На доработку
                  </Button>
                  <Button
                    variant="danger"
                    className="flex-1 py-2 text-[10px]"
                    disabled={!canQuickReject || patchMut.isPending}
                    title={canQuickReject ? 'Отклонить решение' : 'Уже отклонено'}
                    onClick={() =>
                      patchMut.mutate({
                        id: review.id,
                        body: {
                          status: 'REJECTED',
                          mentorScore: 0,
                          mentorComment: normalizedMentorComment(),
                        },
                      })
                    }
                  >
                    Отклонить
                  </Button>
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={patchMut.isPending}
                  onClick={() =>
                    patchMut.mutate({
                      id: review.id,
                      body: {
                        mentorScore: score,
                        status,
                        mentorComment: normalizedMentorComment(),
                      },
                    })
                  }
                >
                  Сохранить оценку
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
