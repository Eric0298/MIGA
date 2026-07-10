import { describe, expect, it } from 'vitest'
import type { ExamAttempt, Goal, Session } from '@/lib/db/schema'
import { computeGoalStatus } from './goal-status'

function makeGoal(overrides: Partial<Goal>): Goal {
  const now = 1_700_000_000_000
  return {
    id: 'goal-1',
    name: 'Meta test',
    targetMinutes: 600,
    scheduledDays: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function completed(overrides: Partial<Session>): Session {
  const now = 1_700_000_000_000
  return {
    id: crypto.randomUUID(),
    goalId: 'goal-1',
    materialIds: [],
    startedAt: now,
    pausedAt: null,
    endedAt: now + 60_000,
    totalPausedMs: 0,
    status: 'completed',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('computeGoalStatus', () => {
  it('is not-started before the first planned day and no activity', () => {
    const goal = makeGoal({
      scheduledDays: ['2026-07-20', '2026-07-21'],
      targetMinutes: 120,
    })
    const result = computeGoalStatus(goal, [], '2026-07-10')
    expect(result.status).toBe('not-started')
    expect(result.expectedMs).toBe(0)
    expect(result.pastCompletedPlannedDays).toBe(0)
  })

  it('is on-track on the same day it starts with no activity yet', () => {
    const goal = makeGoal({
      scheduledDays: ['2026-07-10', '2026-07-15'],
      targetMinutes: 120,
    })
    const result = computeGoalStatus(goal, [], '2026-07-10')
    expect(result.status).toBe('on-track')
    expect(result.pastCompletedPlannedDays).toBe(0)
    expect(result.expectedMs).toBe(0)
  })

  it('is ahead when there is activity before any completed planned day', () => {
    const goal = makeGoal({
      scheduledDays: ['2026-07-10', '2026-07-15'],
      targetMinutes: 120,
    })
    const sessions: Session[] = [
      completed({
        startedAt: new Date(2026, 6, 10, 9).getTime(),
        endedAt: new Date(2026, 6, 10, 9, 30).getTime(),
        totalPausedMs: 0,
      }),
    ]
    const result = computeGoalStatus(goal, sessions, '2026-07-10')
    expect(result.status).toBe('ahead')
  })

  it('is on-track within the grace margin of expected', () => {
    const goal = makeGoal({
      scheduledDays: ['2026-07-05', '2026-07-10', '2026-07-15', '2026-07-20'],
      targetMinutes: 240,
    })
    const sessions: Session[] = [
      completed({
        startedAt: new Date(2026, 6, 5, 10).getTime(),
        endedAt: new Date(2026, 6, 5, 11, 55).getTime(),
        totalPausedMs: 0,
      }),
    ]
    const result = computeGoalStatus(goal, sessions, '2026-07-12')
    expect(result.pastCompletedPlannedDays).toBe(2)
    expect(result.status).toBe('on-track')
  })

  it('is ahead when actual clearly exceeds expected', () => {
    const goal = makeGoal({
      scheduledDays: ['2026-07-05', '2026-07-10', '2026-07-15', '2026-07-20'],
      targetMinutes: 240,
    })
    const sessions: Session[] = [
      completed({
        startedAt: new Date(2026, 6, 5, 10).getTime(),
        endedAt: new Date(2026, 6, 5, 12, 30).getTime(),
        totalPausedMs: 0,
      }),
    ]
    const result = computeGoalStatus(goal, sessions, '2026-07-12')
    expect(result.status).toBe('ahead')
  })

  it('is behind when actual is well below expected', () => {
    const goal = makeGoal({
      scheduledDays: ['2026-07-05', '2026-07-10', '2026-07-15', '2026-07-20'],
      targetMinutes: 240,
    })
    const sessions: Session[] = [
      completed({
        startedAt: new Date(2026, 6, 5, 10).getTime(),
        endedAt: new Date(2026, 6, 5, 10, 20).getTime(),
        totalPausedMs: 0,
      }),
    ]
    const result = computeGoalStatus(goal, sessions, '2026-07-12')
    expect(result.status).toBe('behind')
  })

  it('is complete when total actual reaches target', () => {
    const goal = makeGoal({
      scheduledDays: ['2026-07-05', '2026-07-10'],
      targetMinutes: 60,
    })
    const sessions: Session[] = [
      completed({
        startedAt: new Date(2026, 6, 5, 10).getTime(),
        endedAt: new Date(2026, 6, 5, 11).getTime(),
        totalPausedMs: 0,
      }),
    ]
    const result = computeGoalStatus(goal, sessions, '2026-07-06')
    expect(result.status).toBe('complete')
  })

  it('does not count today as a completed past planned day', () => {
    const goal = makeGoal({
      scheduledDays: ['2026-07-10', '2026-07-20'],
      targetMinutes: 120,
    })
    const result = computeGoalStatus(goal, [], '2026-07-10')
    expect(result.pastCompletedPlannedDays).toBe(0)
    expect(result.status).toBe('on-track')
  })

  it('counts finished exam attempts toward actualMs', () => {
    const goal = makeGoal({
      scheduledDays: ['2026-07-10', '2026-07-15'],
      targetMinutes: 120,
    })
    const now = 1_700_000_000_000
    const exam: ExamAttempt = {
      id: 'e1',
      goalId: 'goal-1',
      kind: 'questions',
      title: 't',
      startedAt: new Date(2026, 6, 10, 9).getTime(),
      pausedAt: null,
      endedAt: new Date(2026, 6, 10, 9, 30).getTime(),
      totalPausedMs: 0,
      status: 'completed',
      timeLimitMs: null,
      score: 5,
      maxScore: 10,
      notes: '',
      questionIds: ['q1'],
      responses: [],
      createdAt: now,
      updatedAt: now,
    }
    const result = computeGoalStatus(goal, [], '2026-07-10', [exam])
    expect(result.actualMs).toBe(30 * 60_000)
    expect(result.status).toBe('ahead')
  })

  it('ignores discarded and in-progress exam attempts', () => {
    const goal = makeGoal({
      scheduledDays: ['2026-07-10', '2026-07-15'],
      targetMinutes: 120,
    })
    const now = 1_700_000_000_000
    const makeExam = (status: ExamAttempt['status'], endedAt: number | null): ExamAttempt => ({
      id: crypto.randomUUID(),
      goalId: 'goal-1',
      kind: 'pdf',
      title: 't',
      startedAt: new Date(2026, 6, 10, 9).getTime(),
      pausedAt: null,
      endedAt,
      totalPausedMs: 0,
      status,
      timeLimitMs: null,
      score: null,
      maxScore: null,
      notes: '',
      createdAt: now,
      updatedAt: now,
    })
    const attempts: ExamAttempt[] = [
      makeExam('discarded', new Date(2026, 6, 10, 10).getTime()),
      makeExam('in-progress', null),
    ]
    const result = computeGoalStatus(goal, [], '2026-07-10', attempts)
    expect(result.actualMs).toBe(0)
    expect(result.status).toBe('on-track')
  })
})
