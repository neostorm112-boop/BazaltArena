import { describe, expect, it } from 'vitest'
import { computeSprintTrend } from '../../src/services/userViewService.js'

describe('computeSprintTrend', () => {
  it('shows +N за месяц when user accepted more sprints', () => {
    expect(computeSprintTrend(3, 1)).toEqual({
      label: '+2 за месяц',
      variant: 'malachite',
      icon: 'trending_up',
    })
  })

  it('shows neutral copy when nothing changed', () => {
    expect(computeSprintTrend(1, 1)).toEqual({
      label: 'без новых принятых за месяц',
      variant: 'slate',
      icon: 'trending_flat',
    })
  })

  it('does not show "-1 к началу месяца" when baseline drifted higher than current', () => {
    const trend = computeSprintTrend(1, 2)
    expect(trend.label).not.toMatch(/^-/u)
    expect(trend.label).not.toMatch(/^−/u)
    expect(trend.variant).toBe('slate')
    expect(trend.icon).toBe('trending_flat')
  })
})
