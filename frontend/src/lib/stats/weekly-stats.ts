import { differenceInCalendarDays, endOfWeek, startOfWeek, subDays, subWeeks } from 'date-fns'
import type { ExamAttempt, Session } from '@/lib/db/schema'
import { fromIso } from '@/features/goals/utils'
import { getElapsedMs } from '@/features/timer/utils'
import { getExamElapsedMs } from '@/lib/db/exam-attempts.repository'
import { toLocalIsoDay } from './sessions-stats'

export type WeekRange = { start: Date; end: Date }

export function getWeekRange(reference: Date): WeekRange {
  return {
    start: startOfWeek(reference, { weekStartsOn: 1 }),
    end: endOfWeek(reference, { weekStartsOn: 1 }),
  }
}

function isCompletedInRange(session: Session, start: number, end: number): boolean {
  if (session.status !== 'completed' || session.endedAt === null) return false
  return session.endedAt >= start && session.endedAt <= end
}

export function sumWeekMs(sessions: Session[], reference: Date): number {
  const { start, end } = getWeekRange(reference)
  const startMs = start.getTime()
  const endMs = end.getTime()
  return sessions
    .filter((s) => isCompletedInRange(s, startMs, endMs))
    .reduce((acc, s) => acc + getElapsedMs(s), 0)
}

export function sumPreviousWeekMs(sessions: Session[], reference: Date): number {
  return sumWeekMs(sessions, subWeeks(reference, 1))
}

export function getWeekDailyMs(sessions: Session[], reference: Date): number[] {
  const { start, end } = getWeekRange(reference)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const daily = new Array<number>(7).fill(0)
  for (const s of sessions) {
    if (!isCompletedInRange(s, startMs, endMs)) continue
    const diff = differenceInCalendarDays(new Date(s.endedAt as number), start)
    if (diff >= 0 && diff < 7) {
      daily[diff] += getElapsedMs(s)
    }
  }
  return daily
}

export type WeekGoalRankEntry = { goalId: string; ms: number }

export function getWeekGoalRanking(sessions: Session[], reference: Date): WeekGoalRankEntry[] {
  const { start, end } = getWeekRange(reference)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const map = new Map<string, number>()
  for (const s of sessions) {
    if (!isCompletedInRange(s, startMs, endMs)) continue
    if (s.goalId === null) continue
    map.set(s.goalId, (map.get(s.goalId) ?? 0) + getElapsedMs(s))
  }
  return Array.from(map.entries())
    .map(([goalId, ms]) => ({ goalId, ms }))
    .sort((a, b) => b.ms - a.ms)
}

export const FREE_SESSION_KEY = 'free' as const
export const EXAM_KEY = 'exam' as const

export type GoalKey = string | typeof FREE_SESSION_KEY | typeof EXAM_KEY

function goalKeyOf(session: Session): GoalKey {
  return session.goalId ?? FREE_SESSION_KEY
}

export function getWeekActiveGoalKeys(sessions: Session[], reference: Date): GoalKey[] {
  const { start, end } = getWeekRange(reference)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const totals = new Map<GoalKey, number>()
  for (const s of sessions) {
    if (!isCompletedInRange(s, startMs, endMs)) continue
    const key = goalKeyOf(s)
    totals.set(key, (totals.get(key) ?? 0) + getElapsedMs(s))
  }
  const withGoals = Array.from(totals.entries())
    .filter(([key]) => key !== FREE_SESSION_KEY)
    .sort((a, b) => b[1] - a[1])
    .map(([key]) => key)
  const hasFree = totals.has(FREE_SESSION_KEY) && (totals.get(FREE_SESSION_KEY) ?? 0) > 0
  return hasFree ? [...withGoals, FREE_SESSION_KEY] : withGoals
}

export function getWeekDailyMsByGoal(
  sessions: Session[],
  reference: Date,
  goalKey: GoalKey | null,
): number[] {
  const { start, end } = getWeekRange(reference)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const daily = new Array<number>(7).fill(0)
  for (const s of sessions) {
    if (!isCompletedInRange(s, startMs, endMs)) continue
    if (goalKey !== null && goalKeyOf(s) !== goalKey) continue
    const diff = differenceInCalendarDays(new Date(s.endedAt as number), start)
    if (diff >= 0 && diff < 7) {
      daily[diff] += getElapsedMs(s)
    }
  }
  return daily
}

export type StackedDailyRow = {
  label: string
  dayIndex: number
} & Record<string, string | number>

export function getWeekStackedDailyMs(
  sessions: Session[],
  reference: Date,
  keys: readonly GoalKey[],
  dayLabels: readonly string[],
): StackedDailyRow[] {
  const rows: StackedDailyRow[] = dayLabels.map((label, dayIndex) => {
    const base: StackedDailyRow = { label, dayIndex }
    for (const key of keys) base[key] = 0
    return base
  })
  const { start, end } = getWeekRange(reference)
  const startMs = start.getTime()
  const endMs = end.getTime()
  for (const s of sessions) {
    if (!isCompletedInRange(s, startMs, endMs)) continue
    const diff = differenceInCalendarDays(new Date(s.endedAt as number), start)
    if (diff < 0 || diff >= 7) continue
    const key = goalKeyOf(s)
    if (!keys.includes(key)) continue
    rows[diff][key] = (rows[diff][key] as number) + Math.round(getElapsedMs(s) / 60_000)
  }
  return rows
}

/**
 * True when an exam attempt finished (graded / completed / pending-grade) within
 * the [start, end] window. Discarded and still-active attempts do not count.
 */
function isFinishedExamInRange(attempt: ExamAttempt, start: number, end: number): boolean {
  if (attempt.endedAt === null) return false
  if (attempt.status === 'discarded' || attempt.status === 'in-progress' || attempt.status === 'paused') {
    return false
  }
  return attempt.endedAt >= start && attempt.endedAt <= end
}

export function sumWeekExamMs(attempts: ExamAttempt[], reference: Date): number {
  const { start, end } = getWeekRange(reference)
  const startMs = start.getTime()
  const endMs = end.getTime()
  return attempts
    .filter((a) => isFinishedExamInRange(a, startMs, endMs))
    .reduce((acc, a) => acc + getExamElapsedMs(a), 0)
}

export function sumPreviousWeekExamMs(attempts: ExamAttempt[], reference: Date): number {
  return sumWeekExamMs(attempts, subWeeks(reference, 1))
}

export function countWeekExamAttempts(attempts: ExamAttempt[], reference: Date): number {
  const { start, end } = getWeekRange(reference)
  const startMs = start.getTime()
  const endMs = end.getTime()
  return attempts.filter((a) => isFinishedExamInRange(a, startMs, endMs)).length
}

export function countPreviousWeekExamAttempts(
  attempts: ExamAttempt[],
  reference: Date,
): number {
  return countWeekExamAttempts(attempts, subWeeks(reference, 1))
}

/**
 * Mean score across attempts that were graded this week. Returns null when
 * the week has no gradable attempts, so callers can render a neutral state
 * instead of a misleading zero.
 */
export function getWeekAvgExamPercent(
  attempts: ExamAttempt[],
  reference: Date,
): number | null {
  const { start, end } = getWeekRange(reference)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const graded = attempts.filter(
    (a) =>
      isFinishedExamInRange(a, startMs, endMs) &&
      a.score !== null &&
      a.maxScore !== null &&
      a.maxScore > 0,
  )
  if (graded.length === 0) return null
  const total = graded.reduce(
    (sum, a) => sum + (a.score as number) / (a.maxScore as number),
    0,
  )
  return Math.round((total / graded.length) * 100)
}

export function getPreviousWeekAvgExamPercent(
  attempts: ExamAttempt[],
  reference: Date,
): number | null {
  return getWeekAvgExamPercent(attempts, subWeeks(reference, 1))
}

/** Daily bucket (minutes) of exam time within the reference week. */
export function getWeekDailyExamMinutes(
  attempts: ExamAttempt[],
  reference: Date,
): number[] {
  const { start, end } = getWeekRange(reference)
  const startMs = start.getTime()
  const endMs = end.getTime()
  const daily = new Array<number>(7).fill(0)
  for (const a of attempts) {
    if (!isFinishedExamInRange(a, startMs, endMs)) continue
    const diff = differenceInCalendarDays(new Date(a.endedAt as number), start)
    if (diff >= 0 && diff < 7) {
      daily[diff] += Math.round(getExamElapsedMs(a) / 60_000)
    }
  }
  return daily
}

/**
 * Merges exam minutes into the pre-built stacked rows under the {@link EXAM_KEY}
 * column when the key is present in `keys`. Rows must already exist for the
 * week (as returned by {@link getWeekStackedDailyMs}).
 */
export function mergeExamMinutesIntoStackedRows(
  rows: StackedDailyRow[],
  attempts: ExamAttempt[],
  reference: Date,
  keys: readonly GoalKey[],
): StackedDailyRow[] {
  if (!keys.includes(EXAM_KEY)) return rows
  const dailyExamMinutes = getWeekDailyExamMinutes(attempts, reference)
  return rows.map((row, i) => ({
    ...row,
    [EXAM_KEY]: (row[EXAM_KEY] as number | undefined ?? 0) + dailyExamMinutes[i],
  }))
}

/**
 * Returns the ordered keys for a week's stacked chart, appending {@link EXAM_KEY}
 * when the week has any finished exam attempt. Non-exam ordering is preserved.
 */
export function getWeekActiveKeysWithExams(
  sessions: Session[],
  attempts: ExamAttempt[],
  reference: Date,
): GoalKey[] {
  const base = getWeekActiveGoalKeys(sessions, reference)
  const hasExamTime = sumWeekExamMs(attempts, reference) > 0
  if (!hasExamTime) return base
  const freeIndex = base.indexOf(FREE_SESSION_KEY)
  if (freeIndex === -1) return [...base, EXAM_KEY]
  const withoutFree = base.filter((k) => k !== FREE_SESSION_KEY)
  return [...withoutFree, EXAM_KEY, FREE_SESSION_KEY]
}

export function getCurrentStreakDays(
  sessions: Session[],
  todayIso: string,
  attempts: ExamAttempt[] = [],
): number {
  const daysWithActivity = new Set<string>()
  for (const s of sessions) {
    if (s.status !== 'completed' || s.endedAt === null) continue
    daysWithActivity.add(toLocalIsoDay(s.endedAt))
  }
  for (const a of attempts) {
    if (a.endedAt === null) continue
    if (a.status === 'discarded' || a.status === 'in-progress' || a.status === 'paused') continue
    daysWithActivity.add(toLocalIsoDay(a.endedAt))
  }
  if (!daysWithActivity.has(todayIso)) return 0
  let streak = 0
  let cursor = fromIso(todayIso)
  while (daysWithActivity.has(toLocalIsoDay(cursor.getTime()))) {
    streak += 1
    cursor = subDays(cursor, 1)
  }
  return streak
}
