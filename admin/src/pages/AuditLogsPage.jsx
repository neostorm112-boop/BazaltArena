import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ApiRequestError, api } from '../api.js'
import { Button } from '../components/ui/button.jsx'
import { Skeleton } from '../components/ui/skeleton.jsx'
import { useAdminTable } from '../hooks/useAdminTable.js'
import { auditLogDescription, auditLogTitle } from '../lib/auditLogLabels.js'
import { roleLabel } from '../lib/copy.js'

function errorExtraHint(error) {
  if (error instanceof ApiRequestError && error.status === 403) {
    return 'Раздел «Логи» доступен только учётной записи с ролью администратора (менторы сюда не допускаются).'
  }
  if (
    error instanceof ApiRequestError &&
    (error.code === 'DATABASE_ERROR' ||
      (typeof error.message === 'string' &&
        (error.message.includes('Database request') || error.message.includes('does not exist'))))
  ) {
    return 'Похоже, на сервере ещё не настроено хранение журнала. Обратитесь к команде, которая обслуживает базу данных, затем обновите страницу.'
  }
  return null
}

export function AuditLogsPage() {
  const tableState = useAdminTable({ pageSize: 25 })
  const { pageIndex, pageSize, pageOffset, pageCount } = tableState

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['admin', 'audit-logs', pageIndex, pageSize],
    queryFn: () => {
      const q = new URLSearchParams({ skip: String(pageOffset), take: String(pageSize) })
      return api(`/admin/audit-logs?${q}`)
    },
    retry: false,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = pageCount(total)
  const auditErrorHint = isError ? errorExtraHint(error) : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-mono text-2xl font-bold uppercase tracking-tight text-catskill">
          Логи
        </h1>
        <p className="mt-2 text-sm text-gull">
          Кто и что менял в системе. Удобно разбирать спорные случаи и проверять действия команды.
        </p>
      </div>

      {isError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200">
          <p className="font-medium">
            {error instanceof Error ? error.message : 'Ошибка загрузки'}
          </p>
          {auditErrorHint ? (
            <p className="mt-3 text-xs leading-relaxed text-red-300/90">{auditErrorHint}</p>
          ) : null}
        </div>
      ) : null}

      {!isError ? (
        <>
          <div className="overflow-x-auto rounded-2xl border border-plantation">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-plantation bg-aztec/80 font-mono text-[10px] uppercase tracking-wide text-slate-arena">
                <tr>
                  <th className="p-3">Время</th>
                  <th className="p-3">Кто</th>
                  <th className="p-3">Тип</th>
                  <th className="p-3">Описание</th>
                </tr>
              </thead>
              <tbody>
                {isPending
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="border-b border-plantation/40">
                        <td className="p-3">
                          <Skeleton className="h-4 w-36" />
                        </td>
                        <td className="p-3">
                          <Skeleton className="h-4 w-28" />
                        </td>
                        <td className="p-3">
                          <Skeleton className="h-4 w-40" />
                        </td>
                        <td className="p-3">
                          <Skeleton className="h-4 w-full max-w-md" />
                        </td>
                      </tr>
                    ))
                  : items.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-plantation/40 align-top hover:bg-white/[0.02]"
                      >
                        <td className="whitespace-nowrap p-3 font-mono text-xs text-gull">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td className="p-3">
                          <div className="font-mono text-xs text-turquoise">
                            @{row.actor?.handle}
                          </div>
                          <div className="text-[10px] text-slate-arena">
                            {roleLabel(row.actor?.role)}
                          </div>
                        </td>
                        <td className="p-3 font-sans text-xs font-medium text-catskill">
                          {auditLogTitle(row.action)}
                        </td>
                        <td className="max-w-xl whitespace-pre-wrap break-words p-3 font-sans text-[11px] leading-relaxed text-gull">
                          {auditLogDescription(row.action, row.details)}
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-gull">
              Стр. {pageIndex + 1} / {totalPages} · записей: {total}
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
        </>
      ) : null}
    </div>
  )
}
