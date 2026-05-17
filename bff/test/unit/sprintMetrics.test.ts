import { describe, expect, it } from 'vitest'
import { computeSuccessRate } from '../../src/services/sprintMetricsService.js'

describe('computeSuccessRate', () => {
  it('returns 25,0% when 1 of 4 submissions verified', () => {
    expect(computeSuccessRate(1, 4)).toBe('25,0%')
  })

  it('returns 100,0% when all verified', () => {
    expect(computeSuccessRate(3, 3)).toBe('100,0%')
  })

  it('returns em dash when no submissions', () => {
    expect(computeSuccessRate(0, 0)).toBe('—')
  })

  it('returns 0,0% when none verified yet', () => {
    expect(computeSuccessRate(0, 4)).toBe('0,0%')
  })

  it('clamps verified above total (defensive)', () => {
    expect(computeSuccessRate(5, 4)).toBe('100,0%')
  })

  it('clamps negative verified (defensive)', () => {
    expect(computeSuccessRate(-1, 4)).toBe('0,0%')
  })
})
