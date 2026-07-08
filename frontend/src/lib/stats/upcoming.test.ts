import { describe, expect, it } from 'vitest'
import type { Goal } from '@/lib/db/schema'
import { findNextPlannedDay } from './upcoming'

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    name: 'Meta',
    targetMinutes: 60,
    scheduledDays: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('findNextPlannedDay', () => {
  it('returns null when no upcoming days exist', () => {
    const goals = [makeGoal({ scheduledDays: ['2026-07-01', '2026-07-02'] })]
    expect(findNextPlannedDay(goals, '2026-07-10')).toBeNull()
  })

  it('returns today when it is planned', () => {
    const goals = [makeGoal({ scheduledDays: ['2026-07-10', '2026-07-15'] })]
    const next = findNextPlannedDay(goals, '2026-07-10')
    expect(next?.day).toBe('2026-07-10')
  })

  it('finds the earliest upcoming day across goals', () => {
    const a = makeGoal({ id: 'a', name: 'A', scheduledDays: ['2026-07-15', '2026-07-20'] })
    const b = makeGoal({ id: 'b', name: 'B', scheduledDays: ['2026-07-12', '2026-07-25'] })
    const next = findNextPlannedDay([a, b], '2026-07-10')
    expect(next?.day).toBe('2026-07-12')
    expect(next?.goal.id).toBe('b')
  })

  it('ignores past days', () => {
    const goals = [makeGoal({ scheduledDays: ['2026-07-01', '2026-07-20'] })]
    const next = findNextPlannedDay(goals, '2026-07-10')
    expect(next?.day).toBe('2026-07-20')
  })
})
