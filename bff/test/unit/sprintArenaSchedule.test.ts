import { describe, expect, it } from 'vitest'
import {
  normalizeDatesForBecomeActive,
  utcStartOfToday,
} from '../../src/domain/sprintArenaSchedule.js'

describe('normalizeDatesForBecomeActive', () => {
  const fixed = new Date('2026-06-10T12:00:00.000Z') // Tuesday noon UTC

  it('sets start to UTC midnight today and end +7d when no end', () => {
    const { startsAt, endsAt } = normalizeDatesForBecomeActive({
      existingEndsAt: null,
      now: fixed,
    })
    expect(startsAt.toISOString()).toBe('2026-06-10T00:00:00.000Z')
    expect(endsAt.toISOString()).toBe('2026-06-17T00:00:00.000Z')
  })

  it('replaces past end with +7d from new start', () => {
    const { startsAt, endsAt } = normalizeDatesForBecomeActive({
      existingEndsAt: new Date('2026-01-01T00:00:00.000Z'),
      now: fixed,
    })
    expect(startsAt.toISOString()).toBe('2026-06-10T00:00:00.000Z')
    expect(endsAt.toISOString()).toBe('2026-06-17T00:00:00.000Z')
  })

  it('keeps future end after new start (manual deadline)', () => {
    const manualEnd = new Date('2026-08-01T23:59:59.000Z')
    const { startsAt, endsAt } = normalizeDatesForBecomeActive({
      existingEndsAt: manualEnd,
      now: fixed,
    })
    expect(startsAt.toISOString()).toBe('2026-06-10T00:00:00.000Z')
    expect(endsAt).toEqual(manualEnd)
  })

  it('replaces end that is after now but before UTC start of today', () => {
    const sameDayMorning = new Date('2026-06-10T08:00:00.000Z')
    const { startsAt, endsAt } = normalizeDatesForBecomeActive({
      existingEndsAt: sameDayMorning,
      now: fixed,
    })
    expect(startsAt.toISOString()).toBe('2026-06-10T00:00:00.000Z')
    expect(endsAt.toISOString()).toBe('2026-06-17T00:00:00.000Z')
  })
})

describe('utcStartOfToday', () => {
  it('returns midnight UTC for the given instant’s calendar day', () => {
    const d = utcStartOfToday(new Date('2026-03-05T23:30:00.000Z'))
    expect(d.toISOString()).toBe('2026-03-05T00:00:00.000Z')
  })
})
