import { describe, expect, it } from 'vitest'
import type { Session } from '@/lib/db/schema'
import { formatDuration, formatShortDuration, getElapsedMs } from './utils'

function baseSession(overrides: Partial<Session>): Session {
  const now = 1_000_000_000_000
  return {
    id: 'test',
    goalId: null,
    materialId: null,
    startedAt: now,
    pausedAt: null,
    endedAt: null,
    totalPausedMs: 0,
    status: 'running',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('timer utils', () => {
  it('formats duration as HH:MM:SS', () => {
    expect(formatDuration(0)).toBe('00:00:00')
    expect(formatDuration(65_000)).toBe('00:01:05')
    expect(formatDuration(3_600_000)).toBe('01:00:00')
    expect(formatDuration(3_661_000)).toBe('01:01:01')
  })

  it('formats short duration in hours and minutes', () => {
    expect(formatShortDuration(0)).toBe('0 min')
    expect(formatShortDuration(60_000)).toBe('1 min')
    expect(formatShortDuration(3_600_000)).toBe('1 h')
    expect(formatShortDuration(3_600_000 + 15 * 60_000)).toBe('1 h 15 min')
  })

  it('computes elapsed for a running session', () => {
    const s = baseSession({ status: 'running', startedAt: 100 })
    expect(getElapsedMs(s, 1100)).toBe(1000)
  })

  it('subtracts totalPausedMs when running', () => {
    const s = baseSession({ status: 'running', startedAt: 100, totalPausedMs: 200 })
    expect(getElapsedMs(s, 1300)).toBe(1000)
  })

  it('freezes elapsed when paused', () => {
    const s = baseSession({
      status: 'paused',
      startedAt: 100,
      pausedAt: 500,
      totalPausedMs: 50,
    })
    expect(getElapsedMs(s, 999_999)).toBe(350)
  })

  it('uses endedAt for completed', () => {
    const s = baseSession({
      status: 'completed',
      startedAt: 100,
      endedAt: 1100,
      totalPausedMs: 100,
    })
    expect(getElapsedMs(s)).toBe(900)
  })
})
