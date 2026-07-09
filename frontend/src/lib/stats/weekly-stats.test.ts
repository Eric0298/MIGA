import { describe, expect, it } from 'vitest'
import type { Session } from '@/lib/db/schema'
import {
  FREE_SESSION_KEY,
  getCurrentStreakDays,
  getWeekActiveGoalKeys,
  getWeekDailyMs,
  getWeekDailyMsByGoal,
  getWeekGoalRanking,
  getWeekRange,
  getWeekStackedDailyMs,
  sumPreviousWeekMs,
  sumWeekMs,
} from './weekly-stats'

function makeSession(overrides: Partial<Session>): Session {
  const base = 1_700_000_000_000
  return {
    id: crypto.randomUUID(),
    goalId: null,
    materialId: null,
    startedAt: base,
    pausedAt: null,
    endedAt: base + 60_000,
    totalPausedMs: 0,
    status: 'completed',
    createdAt: base,
    updatedAt: base,
    ...overrides,
  }
}

function completedAt(day: Date, minutes: number, goalId: string | null = null): Session {
  const end = day.getTime()
  const start = end - minutes * 60_000
  return makeSession({ goalId, startedAt: start, endedAt: end })
}

describe('weekly-stats', () => {
  it('week range starts on Monday', () => {
    const wednesday = new Date(2026, 6, 15, 12)
    const { start, end } = getWeekRange(wednesday)
    expect(start.getDay()).toBe(1)
    expect(end.getDay()).toBe(0)
  })

  it('sums only sessions completed within the week', () => {
    const reference = new Date(2026, 6, 15, 12)
    const inWeek = completedAt(new Date(2026, 6, 13, 10), 60)
    const outOfWeek = completedAt(new Date(2026, 6, 6, 10), 45)
    expect(sumWeekMs([inWeek, outOfWeek], reference)).toBe(60 * 60_000)
  })

  it('distributes minutes across the 7 daily slots (L..D)', () => {
    const reference = new Date(2026, 6, 15, 12)
    const monday = completedAt(new Date(2026, 6, 13, 10), 30)
    const thursday = completedAt(new Date(2026, 6, 16, 10), 45)
    const sunday = completedAt(new Date(2026, 6, 19, 10), 60)

    const daily = getWeekDailyMs([monday, thursday, sunday], reference)
    expect(daily).toHaveLength(7)
    expect(daily[0]).toBe(30 * 60_000)
    expect(daily[3]).toBe(45 * 60_000)
    expect(daily[6]).toBe(60 * 60_000)
    expect(daily[1]).toBe(0)
  })

  it('ranks goals of the week by time, ignoring free sessions', () => {
    const reference = new Date(2026, 6, 15, 12)
    const sessions = [
      completedAt(new Date(2026, 6, 13, 10), 30, 'goal-a'),
      completedAt(new Date(2026, 6, 14, 10), 45, 'goal-b'),
      completedAt(new Date(2026, 6, 15, 10), 60, 'goal-a'),
      completedAt(new Date(2026, 6, 15, 11), 15, null),
    ]
    const ranking = getWeekGoalRanking(sessions, reference)
    expect(ranking.map((r) => r.goalId)).toEqual(['goal-a', 'goal-b'])
    expect(ranking[0].ms).toBe(90 * 60_000)
  })

  it('compares current with previous week', () => {
    const reference = new Date(2026, 6, 15, 12)
    const thisWeek = completedAt(new Date(2026, 6, 13, 10), 60)
    const lastWeek = completedAt(new Date(2026, 6, 6, 10), 45)
    expect(sumWeekMs([thisWeek, lastWeek], reference)).toBe(60 * 60_000)
    expect(sumPreviousWeekMs([thisWeek, lastWeek], reference)).toBe(45 * 60_000)
  })

  it('counts current streak from today backwards', () => {
    const jul10 = new Date(2026, 6, 10, 10).getTime()
    const jul09 = new Date(2026, 6, 9, 10).getTime()
    const jul08 = new Date(2026, 6, 8, 10).getTime()
    const jul06 = new Date(2026, 6, 6, 10).getTime()
    const sessions = [
      makeSession({ startedAt: jul10 - 60_000, endedAt: jul10 }),
      makeSession({ startedAt: jul09 - 60_000, endedAt: jul09 }),
      makeSession({ startedAt: jul08 - 60_000, endedAt: jul08 }),
      makeSession({ startedAt: jul06 - 60_000, endedAt: jul06 }),
    ]
    expect(getCurrentStreakDays(sessions, '2026-07-10')).toBe(3)
  })

  it('returns 0 when today has no activity', () => {
    const jul09 = new Date(2026, 6, 9, 10).getTime()
    const sessions = [makeSession({ startedAt: jul09 - 60_000, endedAt: jul09 })]
    expect(getCurrentStreakDays(sessions, '2026-07-10')).toBe(0)
  })

  it('lists active goal keys of the week, goals first then free if present', () => {
    const reference = new Date(2026, 6, 15, 12)
    const sessions = [
      completedAt(new Date(2026, 6, 13, 10), 30, 'goal-a'),
      completedAt(new Date(2026, 6, 14, 10), 60, 'goal-b'),
      completedAt(new Date(2026, 6, 15, 10), 45, 'goal-a'),
      completedAt(new Date(2026, 6, 16, 10), 15, null),
    ]
    const keys = getWeekActiveGoalKeys(sessions, reference)
    expect(keys).toEqual(['goal-a', 'goal-b', FREE_SESSION_KEY])
  })

  it('filters the daily breakdown by a specific goal or free key', () => {
    const reference = new Date(2026, 6, 15, 12)
    const sessions = [
      completedAt(new Date(2026, 6, 13, 10), 30, 'goal-a'),
      completedAt(new Date(2026, 6, 14, 10), 45, 'goal-b'),
      completedAt(new Date(2026, 6, 15, 10), 60, 'goal-a'),
      completedAt(new Date(2026, 6, 16, 10), 20, null),
    ]
    const dailyA = getWeekDailyMsByGoal(sessions, reference, 'goal-a')
    expect(dailyA[0]).toBe(30 * 60_000)
    expect(dailyA[2]).toBe(60 * 60_000)
    expect(dailyA[1]).toBe(0)

    const dailyFree = getWeekDailyMsByGoal(sessions, reference, FREE_SESSION_KEY)
    expect(dailyFree[3]).toBe(20 * 60_000)
    expect(dailyFree[0]).toBe(0)
  })

  it('returns totals when no goal key is provided', () => {
    const reference = new Date(2026, 6, 15, 12)
    const sessions = [
      completedAt(new Date(2026, 6, 13, 10), 30, 'goal-a'),
      completedAt(new Date(2026, 6, 13, 12), 20, null),
    ]
    const daily = getWeekDailyMsByGoal(sessions, reference, null)
    expect(daily[0]).toBe(50 * 60_000)
  })

  it('builds a stacked weekly matrix with minutes per goal key', () => {
    const reference = new Date(2026, 6, 15, 12)
    const sessions = [
      completedAt(new Date(2026, 6, 13, 10), 30, 'goal-a'),
      completedAt(new Date(2026, 6, 13, 12), 20, 'goal-b'),
      completedAt(new Date(2026, 6, 16, 10), 45, 'goal-b'),
      completedAt(new Date(2026, 6, 16, 12), 15, null),
    ]
    const keys = ['goal-a', 'goal-b', FREE_SESSION_KEY] as const
    const labels = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const
    const rows = getWeekStackedDailyMs(sessions, reference, keys, labels)
    expect(rows).toHaveLength(7)
    expect(rows[0]).toMatchObject({ label: 'L', dayIndex: 0, 'goal-a': 30, 'goal-b': 20 })
    expect(rows[3]).toMatchObject({ label: 'J', 'goal-b': 45, [FREE_SESSION_KEY]: 15 })
  })
})
