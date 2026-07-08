import { describe, expect, it } from 'vitest'
import type { Goal, Session } from '@/lib/db/schema'
import { buildProgressSeries } from './progress-series'

function makeGoal(overrides: Partial<Goal>): Goal {
  return {
    id: 'goal-1',
    name: 'Meta',
    targetMinutes: 240,
    scheduledDays: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function completed(overrides: Partial<Session>): Session {
  return {
    id: crypto.randomUUID(),
    goalId: 'goal-1',
    startedAt: 0,
    pausedAt: null,
    endedAt: 60_000,
    totalPausedMs: 0,
    status: 'completed',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('buildProgressSeries', () => {
  it('returns empty when no planned days', () => {
    expect(buildProgressSeries(makeGoal({}), [], '2026-07-15')).toEqual([])
  })

  it('produces one point per planned day with linear plan', () => {
    const goal = makeGoal({
      targetMinutes: 240,
      scheduledDays: ['2026-07-05', '2026-07-10', '2026-07-15', '2026-07-20'],
    })
    const series = buildProgressSeries(goal, [], '2026-07-01')
    expect(series.map((p) => p.plan)).toEqual([60, 120, 180, 240])
    expect(series.every((p) => p.real === 0)).toBe(true)
  })

  it('accumulates real minutes on days with sessions', () => {
    const goal = makeGoal({
      targetMinutes: 240,
      scheduledDays: ['2026-07-05', '2026-07-10', '2026-07-15', '2026-07-20'],
    })
    const day = (h: number) => new Date(2026, 6, h, 10).getTime()
    const sessions: Session[] = [
      completed({ startedAt: day(5), endedAt: day(5) + 30 * 60_000 }),
      completed({ startedAt: day(15), endedAt: day(15) + 60 * 60_000 }),
    ]
    const series = buildProgressSeries(goal, sessions, '2026-07-01')
    expect(series.find((p) => p.day === '2026-07-05')?.real).toBe(30)
    expect(series.find((p) => p.day === '2026-07-15')?.real).toBe(90)
    expect(series.find((p) => p.day === '2026-07-20')?.real).toBe(90)
  })

  it('includes today when between first and last planned day', () => {
    const goal = makeGoal({
      targetMinutes: 240,
      scheduledDays: ['2026-07-05', '2026-07-20'],
    })
    const series = buildProgressSeries(goal, [], '2026-07-10')
    expect(series.map((p) => p.day)).toContain('2026-07-10')
  })
})
