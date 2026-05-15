import { describe, expect, it } from 'vitest'
import {
  filterHallSprintsForPublic,
  hallTabRankZeroBased,
} from '../../src/services/hallPublicFilter.js'

type Row = { id: string; solutions: unknown[]; endsAt: string | null }

describe('filterHallSprintsForPublic', () => {
  it('кладёт активный спринт первым, остальные по endsAt по убыванию', () => {
    const active: Row = { id: 'a', solutions: [], endsAt: null }
    const newer: Row = {
      id: 'n',
      solutions: [{}],
      endsAt: '2025-06-01T00:00:00.000Z',
    }
    const older: Row = {
      id: 'o',
      solutions: [{}],
      endsAt: '2024-01-01T00:00:00.000Z',
    }
    const out = filterHallSprintsForPublic([older, active, newer], 'a')
    expect(out.map((s) => s.id)).toEqual(['a', 'n', 'o'])
  })

  it('без активного — только спринты с решениями, по endsAt desc', () => {
    const a: Row = { id: '1', solutions: [{}], endsAt: '2023-01-01T00:00:00.000Z' }
    const b: Row = { id: '2', solutions: [{}], endsAt: '2025-01-01T00:00:00.000Z' }
    const empty: Row = { id: 'x', solutions: [], endsAt: '2026-01-01T00:00:00.000Z' }
    const out = filterHallSprintsForPublic([a, empty, b], null)
    expect(out.map((s) => s.id)).toEqual(['2', '1'])
  })

  it('активный без решений остаётся в списке', () => {
    const active: Row = { id: 'a', solutions: [], endsAt: null }
    const done: Row = { id: 'd', solutions: [{}], endsAt: '2024-05-01T00:00:00.000Z' }
    const out = filterHallSprintsForPublic([done, active], 'a')
    expect(out.map((s) => s.id)).toEqual(['a', 'd'])
  })
})

describe('hallTabRankZeroBased', () => {
  it('первый таб (индекс 0) получает максимальный номер', () => {
    expect(hallTabRankZeroBased(3, 0)).toBe(2)
    expect(hallTabRankZeroBased(3, 1)).toBe(1)
    expect(hallTabRankZeroBased(3, 2)).toBe(0)
  })
})
