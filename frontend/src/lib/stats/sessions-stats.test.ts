import { describe, expect, it } from 'vitest'
import type { ExamAttempt, Session } from '@/lib/db/schema'
import {
  filterCompletedByDay,
  filterCompletedByGoal,
  filterFinishedExamsByGoal,
  groupCompletedMsByDay,
  groupExamMsByDay,
  sumElapsedMs,
  sumExamElapsedMs,
  toLocalIsoDay,
} from './sessions-stats'

function completed(overrides: Partial<Session>): Session {
  const base = 1_700_000_000_000
  return {
    id: overrides.id ?? crypto.randomUUID(),
    goalId: null,
    materialIds: [],
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

  it('groups completed sessions ms by local day', () => {
    const dayA = new Date(2026, 6, 15, 10, 0, 0).getTime()
    const dayB = new Date(2026, 6, 16, 10, 0, 0).getTime()
    const sessions: Session[] = [
      completed({ startedAt: dayA, endedAt: dayA + 60_000, totalPausedMs: 10_000 }),
      completed({ startedAt: dayA, endedAt: dayA + 120_000, totalPausedMs: 20_000 }),
      completed({ startedAt: dayB, endedAt: dayB + 30_000, totalPausedMs: 0 }),
      { ...completed({ endedAt: dayA + 5_000 }), status: 'discarded' },
    ]
    const grouped = groupCompletedMsByDay(sessions)
    expect(grouped.get('2026-07-15')).toBe(50_000 + 100_000)
    expect(grouped.get('2026-07-16')).toBe(30_000)
    expect(grouped.size).toBe(2)
  })

  it('sums elapsed ms discounting total paused ms', () => {
    const sessions: Session[] = [
      completed({ startedAt: 0, endedAt: 60_000, totalPausedMs: 10_000 }),
      completed({ startedAt: 0, endedAt: 120_000, totalPausedMs: 20_000 }),
    ]
    expect(sumElapsedMs(sessions)).toBe(50_000 + 100_000)
  })
})

function examAttempt(overrides: Partial<ExamAttempt>): ExamAttempt {
  const base = 1_700_000_000_000
  return {
    id: overrides.id ?? crypto.randomUUID(),
    goalId: 'goal-a',
    kind: 'pdf',
    title: 't',
    startedAt: base,
    pausedAt: null,
    endedAt: base + 60_000,
    totalPausedMs: 0,
    status: 'graded',
    timeLimitMs: null,
    score: 8,
    maxScore: 10,
    notes: '',
    createdAt: base,
    updatedAt: base,
    ...overrides,
  }
}

describe('exam-attempt stats', () => {
  it('filters finished exams by goal, skipping discarded and active', () => {
    const attempts: ExamAttempt[] = [
      examAttempt({ goalId: 'goal-a', status: 'graded' }),
      examAttempt({ goalId: 'goal-a', status: 'completed' }),
      examAttempt({ goalId: 'goal-a', status: 'in-progress', endedAt: null }),
      examAttempt({ goalId: 'goal-a', status: 'discarded' }),
      examAttempt({ goalId: 'goal-b', status: 'graded' }),
    ]
    const result = filterFinishedExamsByGoal(attempts, 'goal-a')
    expect(result).toHaveLength(2)
    expect(result.every((a) => a.goalId === 'goal-a')).toBe(true)
  })

  it('sums exam elapsed ms discounting paused time', () => {
    const attempts: ExamAttempt[] = [
      examAttempt({ startedAt: 0, endedAt: 60_000, totalPausedMs: 10_000 }),
      examAttempt({ startedAt: 0, endedAt: 120_000, totalPausedMs: 20_000 }),
    ]
    expect(sumExamElapsedMs(attempts)).toBe(50_000 + 100_000)
  })

  it('groups exam ms by the day the attempt finished', () => {
    const dayA = new Date(2026, 6, 15, 10, 0, 0).getTime()
    const dayB = new Date(2026, 6, 16, 10, 0, 0).getTime()
    const attempts: ExamAttempt[] = [
      examAttempt({ startedAt: dayA, endedAt: dayA + 60_000, totalPausedMs: 0 }),
      examAttempt({ startedAt: dayA, endedAt: dayA + 120_000, totalPausedMs: 20_000 }),
      examAttempt({ startedAt: dayB, endedAt: dayB + 30_000, totalPausedMs: 0 }),
      examAttempt({ status: 'discarded', endedAt: dayA + 999 }),
    ]
    const grouped = groupExamMsByDay(attempts)
    expect(grouped.get('2026-07-15')).toBe(60_000 + 100_000)
    expect(grouped.get('2026-07-16')).toBe(30_000)
    expect(grouped.size).toBe(2)
  })
})
