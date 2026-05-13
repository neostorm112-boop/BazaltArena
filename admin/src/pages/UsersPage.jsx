import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, Code2, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../api.js'
import { UserEditSheet } from '../components/UserEditSheet.jsx'
import { Button } from '../components/ui/button.jsx'
import { Checkbox } from '../components/ui/checkbox.jsx'
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
import { useAdminTable } from '../hooks/useAdminTable.js'
import { useDebouncedValue } from '../hooks/useDebouncedValue.js'
import { roleLabel } from '../lib/copy.js'

const columnHelper = createColumnHelper()

function telegramHref(t) {
  if (!t || typeof t !== 'string' || !t.trim()) return null
  const s = t.trim()
  if (/^https?:\/\//i.test(s)) return s
  return `https://t.me/${s.replace(/^@/, '')}`
}

function githubHref(g) {
  if (!g || typeof g !== 'string' || !g.trim()) return null
  const s = g.trim()
  if (/^https?:\/\//i.test(s)) return s
  const path = s.startsWith('/') ? s : `/${s}`
  return `https://github.com${path}`
}

export function UsersPage() {
  const qc = useQueryClient()
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebouncedValue(searchInput, 400)
  const tableState = useAdminTable({
    pageSize: 15,
    resetDeps: [searchInput],
    withRowSelection: true,
  })
  const {
    pageIndex,
    pageSize,
    pageOffset,
    rowSelection,
    setRowSelection,
    pageCount,
    onPaginationChange,
    clearSelection,
  } = tableState

  const { data, isPending } = useQuery({
    queryKey: ['admin', 'users', debouncedSearch, pageIndex, pageSize],
    queryFn: () => {
      const q = new URLSearchParams({ take: String(pageSize), skip: String(pageOffset) })
      if (debouncedSearch.trim()) q.set('search', debouncedSearch.trim())
      return api(`/admin/users?${q}`)
    },
  })

  const { data: sprints } = useQuery({
    queryKey: ['admin', 'sprints'],
    queryFn: () => api('/admin/sprints'),
  })

  const [sheetUser, setSheetUser] = useState(null)

  const patchMutation = useMutation({
    mutationFn: ({ id, body }) =>
      api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    onSuccess: () => {
      toast.success('Пользователь обновлён')
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      setSheetUser(null)
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const batchAccessMutation = useMutation({
    mutationFn: ({ sprintId, userIds, canSubmit, canView }) =>
      api(`/admin/sprints/${sprintId}/access/batch`, {
        method: 'PUT',
        body: JSON.stringify({ userIds, canSubmit, canView }),
      }),
    onSuccess: (_d, v) => {
      toast.success(`Доступ: ${v.userIds.length} пользователей`)
      clearSelection()
      void qc.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Ошибка'),
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = pageCount(total)

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
            aria-label="Выбрать страницу"
          />
        ),
        cell: ({ row }) => (
          <div onClick={(e) => e.stopPropagation()} role="presentation">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(v) => row.toggleSelected(!!v)}
              aria-label="Выбрать строку"
            />
          </div>
        ),
        size: 36,
      }),
      columnHelper.display({
        id: 'identity',
        header: () => <span className="text-[10px] uppercase tracking-wide">Профиль</span>,
        cell: ({ row }) => {
          const u = row.original
          const tg = telegramHref(u.telegram)
          const gh = githubHref(u.github)
          return (
            <div className="flex items-center gap-2">
              <img
                src={u.avatarUrl}
                alt=""
                className="h-9 w-9 shrink-0 rounded-full border border-plantation bg-aztec object-cover"
              />
              <div className="flex items-center gap-0.5">
                {tg ? (
                  <a
                    href={tg}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded p-1 text-gull hover:bg-white/10 hover:text-turquoise"
                    title="Telegram"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Send className="h-4 w-4" />
                  </a>
                ) : null}
                {gh ? (
                  <a
                    href={gh}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded p-1 text-gull hover:bg-white/10 hover:text-turquoise"
                    title="GitHub"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Code2 className="h-4 w-4" />
                  </a>
                ) : null}
              </div>
            </div>
          )
        },
        size: 120,
      }),
      columnHelper.accessor('handle', {
        header: 'Ник',
        cell: (info) => <span className="font-mono text-turquoise">{info.getValue()}</span>,
      }),
      columnHelper.accessor('email', {
        header: 'Почта',
        cell: (info) => <span className="text-gull">{info.getValue()}</span>,
      }),
      columnHelper.accessor('role', {
        header: 'Роль',
        cell: (info) => <span>{roleLabel(info.getValue())}</span>,
      }),
      columnHelper.accessor('points', { header: 'Баллы' }),
      columnHelper.display({
        id: 'quick',
        header: '',
        cell: ({ row }) => (
          <Button
            variant="outline"
            className="py-1 text-[10px]"
            onClick={(e) => {
              e.stopPropagation()
              void (async () => {
                try {
                  await api(`/admin/users/${row.original.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ points: (row.original.points ?? 0) + 10 }),
                  })
                  toast.success(`+10 → ${row.original.handle}`)
                  void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Ошибка')
                }
              })()
            }}
          >
            +10
          </Button>
        ),
      }),
    ],
    [qc]
  )

  const table = useReactTable({
    data: items,
    columns,
    state: { rowSelection, pagination: { pageIndex, pageSize } },
    onRowSelectionChange: setRowSelection,
    manualPagination: true,
    pageCount: totalPages,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: true,
    onPaginationChange,
  })

  const selectedIds = table.getSelectedRowModel().rows.map((r) => r.original.id)
  const [batchSprintId, setBatchSprintId] = useState('')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold uppercase tracking-tight text-catskill">
          Пользователи
        </h1>
        <p className="mt-2 text-sm text-gull">
          Поиск по почте и нику, карточка участника с вкладками. Ниже можно выдать доступ к спринту
          сразу нескольким выбранным людям.
        </p>
      </div>

      {selectedIds.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-turquoise/30 bg-turquoise/5 px-4 py-3">
          <span className="font-mono text-xs text-catskill">
            Выбрано: <b>{selectedIds.length}</b>
          </span>
          {(sprints?.sprints ?? []).length > 0 ? (
            <Select value={batchSprintId || undefined} onValueChange={setBatchSprintId}>
              <SelectTrigger className="min-w-[220px] rounded-lg">
                <SelectValue placeholder="Выберите спринт…" />
              </SelectTrigger>
              <SelectContent>
                {(sprints?.sprints ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="font-sans text-xs text-gull">Нет спринтов для выдачи доступа.</span>
          )}
          <Button
            variant="gradient"
            className="py-2"
            disabled={!batchSprintId || batchAccessMutation.isPending}
            onClick={() => {
              if (!batchSprintId) return
              batchAccessMutation.mutate({
                sprintId: batchSprintId,
                userIds: selectedIds,
                canSubmit: true,
                canView: true,
              })
            }}
          >
            Выдать доступ
          </Button>
        </div>
      ) : null}

      <div className="rounded-2xl border border-plantation bg-timber/30 px-4 py-4">
        <Label>Поиск</Label>
        <Input
          className="mt-2 max-w-lg"
          placeholder="Почта или ник"
          value={searchInput}
          onChange={(e) => {
            setSearchInput(e.target.value)
            tableState.setPageIndex(0)
          }}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-plantation">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-plantation bg-aztec/80 font-mono text-[10px] uppercase tracking-wide text-slate-arena">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="p-3 align-top" style={{ width: h.getSize() }}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {isPending
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-plantation/40">
                    <td className="p-3">
                      <Skeleton className="h-4 w-4" />
                    </td>
                    <td className="p-3">
                      <Skeleton className="h-9 w-24" />
                    </td>
                    <td className="p-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="p-3">
                      <Skeleton className="h-4 w-48" />
                    </td>
                    <td className="p-3">
                      <Skeleton className="h-4 w-16" />
                    </td>
                    <td className="p-3">
                      <Skeleton className="h-4 w-8" />
                    </td>
                    <td className="p-3">
                      <Skeleton className="h-8 w-14" />
                    </td>
                  </tr>
                ))
              : table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-plantation/40 hover:bg-white/[0.03]"
                    onClick={() => setSheetUser(row.original)}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="p-3 align-middle">
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
          Стр. {pageIndex + 1} / {totalPages} · всего {total}
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

      <UserEditSheet
        user={sheetUser}
        open={!!sheetUser}
        onOpenChange={(o) => !o && setSheetUser(null)}
        isPending={patchMutation.isPending}
        onSave={(id, body) => patchMutation.mutate({ id, body })}
      />
    </div>
  )
}
