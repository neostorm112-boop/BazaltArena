import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Общая пагинация/selection для таблиц админки.
 * @param {{ pageSize: number, resetDeps?: unknown[], withRowSelection?: boolean }} opts
 */
export function useAdminTable({ pageSize, resetDeps = [], withRowSelection = false }) {
  const [pageIndex, setPageIndex] = useState(0)
  const [rowSelection, setRowSelection] = useState({})

  useEffect(() => {
    setPageIndex(0)
  }, resetDeps)

  useEffect(() => {
    if (!withRowSelection) return
    setRowSelection({})
  }, [withRowSelection, pageIndex, ...resetDeps])

  const pageOffset = pageIndex * pageSize
  const pageCount = useCallback(
    (total) => Math.max(1, Math.ceil((total ?? 0) / pageSize)),
    [pageSize]
  )

  const onPaginationChange = useCallback(
    (updater) => {
      const next = typeof updater === 'function' ? updater({ pageIndex, pageSize }) : updater
      setPageIndex(next.pageIndex)
    },
    [pageIndex, pageSize]
  )

  const clearSelection = useCallback(() => {
    if (!withRowSelection) return
    setRowSelection({})
  }, [withRowSelection])

  return useMemo(
    () => ({
      pageIndex,
      setPageIndex,
      pageSize,
      pageOffset,
      rowSelection,
      setRowSelection,
      pageCount,
      onPaginationChange,
      clearSelection,
    }),
    [pageCount, pageIndex, pageOffset, pageSize, rowSelection, onPaginationChange, clearSelection]
  )
}
