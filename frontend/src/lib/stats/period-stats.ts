import { subDays } from 'date-fns'
import type { ExamAttempt, Goal, Question, Session } from '@/lib/db/schema'
import { getElapsedMs } from '@/features/timer/utils'
import { toLocalIsoDay } from './sessions-stats'

export type PeriodKey = '7d' | '30d' | '90d' | 'all'

export type PeriodRange = {
  /** Inclusive start (milliseconds since epoch). Null means "no lower bound". */
  startMs: number | null
  /** Inclusive end (milliseconds since epoch). */
  endMs: number
  /** Number of calendar days spanned. `null` for the all-time bucket. */
  days: number | null
}

/**
 * Returns a [startMs, endMs] window ending at `reference` for the given period.
 * `all` returns an open-ended lower bound so upstream code can skip filtering.
 */
export function getPeriodRange(period: PeriodKey, reference: Date = new Date()): PeriodRange {
  const endOfDay = new Date(reference)
  endOfDay.setHours(23, 59, 59, 999)
  const endMs = endOfDay.getTime()
  if (period === 'all') {
    return { startMs: null, endMs, days: null }
  }
  const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
  const start = subDays(reference, days - 1)
  start.setHours(0, 0, 0, 0)
  return { startMs: start.getTime(), endMs, days }
}

/**
 * Previous window of the same length, aligned right before `range.startMs`.
 * Returns null for the all-time bucket (nothing to compare against).
 */
export function getPreviousPeriodRange(range: PeriodRange): PeriodRange | null {
  if (range.days === null || range.startMs === null) return null
  const endMs = range.startMs - 1
  const startMs = endMs - range.days * 24 * 60 * 60 * 1000 + 1
  return { startMs, endMs, days: range.days }
}

function inRange(ts: number, range: PeriodRange): boolean {
  if (range.startMs !== null && ts < range.startMs) return false
  return ts <= range.endMs
}

function isCompletedIn(session: Session, range: PeriodRange): boolean {
  if (session.status !== 'completed' || session.endedAt === null) return false
  return inRange(session.endedAt, range)
}

function isFinishedExamIn(attempt: ExamAttempt, range: PeriodRange): boolean {
  if (attempt.endedAt === null) return false
  if (
    attempt.status === 'discarded' ||
    attempt.status === 'in-progress' ||
    attempt.status === 'paused'
  ) {
    return false
  }
  return inRange(attempt.endedAt, range)
}

export function filterSessionsInRange(sessions: Session[], range: PeriodRange): Session[] {
  return sessions.filter((s) => isCompletedIn(s, range))
}

export function filterExamsInRange(attempts: ExamAttempt[], range: PeriodRange): ExamAttempt[] {
  return attempts.filter((a) => isFinishedExamIn(a, range))
}

export function sumSessionsMs(sessions: Session[]): number {
  return sessions.reduce((acc, s) => acc + getElapsedMs(s), 0)
}

export type PerGoalTime = {
  goalId: string | null
  goalName: string
  ms: number
  targetMinutes: number | null
  progressPercent: number | null
}

/**
 * Aggregates session time by goal within the range. `null` goalId represents
 * the "free session" bucket, and the goal-target progress is scaled to the
 * fraction of the plan's target that would be expected to fall inside the range
 * (target × range.days / 7). All-time returns absolute totals with no target.
 */
export function timePerGoal(
  sessions: Session[],
  goals: Goal[],
  range: PeriodRange,
  freeSessionLabel: string,
): PerGoalTime[] {
  const totals = new Map<string, number>()
  const filtered = filterSessionsInRange(sessions, range)
  for (const s of filtered) {
    const key = s.goalId ?? '__free__'
    totals.set(key, (totals.get(key) ?? 0) + getElapsedMs(s))
  }
  const entries: PerGoalTime[] = []
  for (const goal of goals) {
    const ms = totals.get(goal.id) ?? 0
    if (ms === 0) continue
    const targetMinutes = scaleTargetToRange(goal.targetMinutes, range)
    const progressPercent =
      targetMinutes === null || targetMinutes <= 0
        ? null
        : Math.min(999, Math.round((ms / 60_000 / targetMinutes) * 100))
    entries.push({
      goalId: goal.id,
      goalName: goal.name,
      ms,
      targetMinutes,
      progressPercent,
    })
  }
  const freeMs = totals.get('__free__') ?? 0
  if (freeMs > 0) {
    entries.push({
      goalId: null,
      goalName: freeSessionLabel,
      ms: freeMs,
      targetMinutes: null,
      progressPercent: null,
    })
  }
  return entries.sort((a, b) => b.ms - a.ms)
}

function scaleTargetToRange(weeklyTargetMinutes: number, range: PeriodRange): number | null {
  if (range.days === null) return null
  return Math.round((weeklyTargetMinutes * range.days) / 7)
}

export type DayBucket = {
  day: string
  minutes: number
  sessions: number
}

/**
 * Daily buckets covering every calendar day of the range (sorted ascending).
 * When `range.days === null` (all-time), buckets span from the first completed
 * session to today so early empty days do not create a huge void.
 */
export function dailyMinutesInRange(sessions: Session[], range: PeriodRange): DayBucket[] {
  const filtered = filterSessionsInRange(sessions, range)
  const bucket = new Map<string, DayBucket>()
  let earliest = Number.POSITIVE_INFINITY
  for (const s of filtered) {
    const day = toLocalIsoDay(s.endedAt as number)
    const existing = bucket.get(day) ?? { day, minutes: 0, sessions: 0 }
    existing.minutes += Math.round(getElapsedMs(s) / 60_000)
    existing.sessions += 1
    bucket.set(day, existing)
    if ((s.endedAt as number) < earliest) earliest = s.endedAt as number
  }
  const start =
    range.startMs !== null
      ? new Date(range.startMs)
      : earliest === Number.POSITIVE_INFINITY
        ? new Date(range.endMs)
        : startOfLocalDay(earliest)
  const end = new Date(range.endMs)
  const days: DayBucket[] = []
  const cursor = new Date(start)
  while (cursor.getTime() <= end.getTime()) {
    const day = toLocalIsoDay(cursor.getTime())
    days.push(bucket.get(day) ?? { day, minutes: 0, sessions: 0 })
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function startOfLocalDay(ts: number): Date {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Best consecutive-active-days streak using every session/exam in the input. */
export function getBestStreakDays(sessions: Session[], attempts: ExamAttempt[]): number {
  const days = new Set<string>()
  for (const s of sessions) {
    if (s.status !== 'completed' || s.endedAt === null) continue
    days.add(toLocalIsoDay(s.endedAt))
  }
  for (const a of attempts) {
    if (a.endedAt === null) continue
    if (a.status === 'discarded' || a.status === 'in-progress' || a.status === 'paused') continue
    days.add(toLocalIsoDay(a.endedAt))
  }
  if (days.size === 0) return 0
  const sorted = Array.from(days).sort()
  let best = 1
  let current = 1
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1])
    const curr = new Date(sorted[i])
    const diff = Math.round((curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000))
    if (diff === 1) {
      current += 1
      if (current > best) best = current
    } else {
      current = 1
    }
  }
  return best
}

export type ExamScore = {
  attemptId: string
  endedAt: number
  day: string
  percent: number
  title: string
}

export function examScoresInRange(attempts: ExamAttempt[], range: PeriodRange): ExamScore[] {
  return attempts
    .filter(
      (a) =>
        isFinishedExamIn(a, range) && a.score !== null && a.maxScore !== null && a.maxScore > 0,
    )
    .sort((a, b) => (a.endedAt as number) - (b.endedAt as number))
    .map((a) => ({
      attemptId: a.id,
      endedAt: a.endedAt as number,
      day: toLocalIsoDay(a.endedAt as number),
      percent: Math.round(((a.score as number) / (a.maxScore as number)) * 100),
      title: a.title,
    }))
}

export type QuestionStats = {
  answered: number
  correct: number
  incorrect: number
  accuracy: number | null
  perGoal: Array<{
    goalId: string
    goalName: string
    seen: number
    correct: number
    accuracy: number | null
  }>
}

/**
 * Aggregates review counters carried by every question. This is cheap because
 * `reviewState.timesSeen/timesCorrect/timesIncorrect` are already maintained
 * by the SRS worker each time the user answers a card.
 */
export function questionStats(questions: Question[], goals: Goal[]): QuestionStats {
  const byGoal = new Map<string, { seen: number; correct: number; incorrect: number }>()
  let answered = 0
  let correct = 0
  let incorrect = 0
  for (const q of questions) {
    const state = q.reviewState
    if (!state) continue
    answered += state.timesSeen
    correct += state.timesCorrect
    incorrect += state.timesIncorrect
    const entry = byGoal.get(q.goalId) ?? { seen: 0, correct: 0, incorrect: 0 }
    entry.seen += state.timesSeen
    entry.correct += state.timesCorrect
    entry.incorrect += state.timesIncorrect
    byGoal.set(q.goalId, entry)
  }
  const accuracy = answered === 0 ? null : Math.round((correct / answered) * 100)
  const perGoal = Array.from(byGoal.entries())
    .map(([goalId, agg]) => {
      const goal = goals.find((g) => g.id === goalId)
      return {
        goalId,
        goalName: goal?.name ?? '—',
        seen: agg.seen,
        correct: agg.correct,
        accuracy: agg.seen === 0 ? null : Math.round((agg.correct / agg.seen) * 100),
      }
    })
    .sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100))
  return { answered, correct, incorrect, accuracy, perGoal }
}

export type PercentDelta = {
  kind: 'up' | 'down' | 'same' | 'none'
  percent: number
}

/**
 * Percent change between two totals. `none` when there's no baseline to divide
 * by. Rounds to whole percentages so KPI cards read cleanly.
 */
export function percentDelta(current: number, previous: number): PercentDelta {
  if (previous <= 0) {
    return { kind: current > 0 ? 'up' : 'none', percent: current > 0 ? 100 : 0 }
  }
  const raw = ((current - previous) / previous) * 100
  const rounded = Math.round(raw)
  if (rounded === 0) return { kind: 'same', percent: 0 }
  return { kind: rounded > 0 ? 'up' : 'down', percent: rounded }
}
