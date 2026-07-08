import { describe, expect, it } from 'vitest'
import type { Session } from '@/lib/db/schema'
import {
  filterCompletedByDay,
  filterCompletedByGoal,
  sumElapsedMs,
  toLocalIsoDay,
} from './sessions-stats'

function completed(overrides: Partial<Session>): Session {
  const base = 1_700_000_000_000
  return {
    id: overrides.id ?? crypto.randomUUID(),
    goalId: null,
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

describe('sessions-stats', () => {
  it('converts epoch to local iso day', () => {
    const iso = toLocalIsoDay(new Date(2026, 6, 15, 12, 0, 0).getTime())
    expect(iso).toBe('2026-07-15')
  })

  it('filters completed sessions by day using endedAt', () => {
    const day = new Date(2026, 6, 15, 10, 0, 0).getTime()
    const other = new Date(2026, 6, 16, 10, 0, 0).getTime()
    const sessions: Session[] = [
      completed({ endedAt: day }),
      completed({ endedAt: other }),
      completed({ endedAt: day + 3_600_000 }),
    ]
    const filtered = filterCompletedByDay(sessions, '2026-07-15')
    expect(filtered).toHaveLength(2)
  })

  it('ignores running or discarded when filtering by day', () => {
    const day = new Date(2026, 6, 15, 10, 0, 0).getTime()
    const sessions: Session[] = [
      completed({ endedAt: day }),
      { ...completed({ endedAt: day }), status: 'running', endedAt: null },
      { ...completed({ endedAt: day }), status: 'discarded' },
    ]
    const filtered = filterCompletedByDay(sessions, '2026-07-15')
    expect(filtered).toHaveLength(1)
  })

  it('filters completed sessions by goal', () => {
    const sessions: Session[] = [
      completed({ goalId: 'goal-a' }),
      completed({ goalId: 'goal-b' }),
      completed({ goalId: 'goal-a' }),
    ]
    expect(filterCompletedByGoal(sessions, 'goal-a')).toHaveLength(2)
  })

  it('sums elapsed ms discounting total paused ms', () => {
    const sessions: Session[] = [
      completed({ startedAt: 0, endedAt: 60_000, totalPausedMs: 10_000 }),
      completed({ startedAt: 0, endedAt: 120_000, totalPausedMs: 20_000 }),
    ]
    expect(sumElapsedMs(sessions)).toBe(50_000 + 100_000)
  })
})
