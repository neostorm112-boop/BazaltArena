/**
 * Порядок спринтов в публичном зале славы: арена (даже без решений) первая,
 * остальные — по дате окончания (новее раньше).
 */
export function filterHallSprintsForPublic<
  T extends { id: string; solutions: unknown[]; endsAt: string | null },
>(details: T[], activeId: string | null | undefined): T[] {
  const eligible = details.filter((s) => {
    const isArena = activeId != null && s.id === activeId
    return isArena || s.solutions.length > 0
  })
  if (!activeId) {
    return [...eligible].sort((a, b) => {
      const ta = a.endsAt ? new Date(a.endsAt).getTime() : 0
      const tb = b.endsAt ? new Date(b.endsAt).getTime() : 0
      return tb - ta
    })
  }
  const active = eligible.find((s) => s.id === activeId)
  const rest = eligible
    .filter((s) => s.id !== activeId)
    .sort((a, b) => {
      const ta = a.endsAt ? new Date(a.endsAt).getTime() : 0
      const tb = b.endsAt ? new Date(b.endsAt).getTime() : 0
      return tb - ta
    })
  return active ? [active, ...rest] : rest
}

/** Номер вкладки как в legacy UI: #0 — самый «старый» в списке, #n-1 — первый таб (актуальный). */
export function hallTabRankZeroBased(visibleCount: number, indexInVisible: number): number {
  if (visibleCount <= 0 || indexInVisible < 0 || indexInVisible >= visibleCount) return 0
  return visibleCount - 1 - indexInVisible
}
