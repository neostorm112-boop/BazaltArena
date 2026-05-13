const DAY_MS = 24 * 60 * 60 * 1000

/** Начало текущего календарного дня по UTC (как в админке toIsoStartOfDay). */
export function utcStartOfToday(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
}

/**
 * При выводе спринта на арену: старт — сегодня (UTC); финиш — сохраняем «ручной»
 * будущий дедлайн, если он всё ещё впереди и позже старта; иначе +7 суток от старта.
 */
export function normalizeDatesForBecomeActive(params: {
  existingEndsAt: Date | null
  now?: Date
}): { startsAt: Date; endsAt: Date } {
  const now = params.now ?? new Date()
  const startsAt = utcStartOfToday(now)

  const prevEnd = params.existingEndsAt
  const keepManualEnd =
    prevEnd != null && prevEnd.getTime() > now.getTime() && prevEnd.getTime() > startsAt.getTime()

  const endsAt = keepManualEnd ? prevEnd : new Date(startsAt.getTime() + 7 * DAY_MS)

  return { startsAt, endsAt }
}
