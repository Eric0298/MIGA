import { differenceInCalendarDays, endOfWeek, startOfWeek, subDays, subWeeks } from 'date-fns'
import type { Session } from '@/lib/db/schema'
import { fromIso } from '@/features/goals/utils'
import { getElapsedMs } from '@/features/timer/utils'
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

export type GoalKey = string | typeof FREE_SESSION_KEY

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

export function getCurrentStreakDays(sessions: Session[], todayIso: string): number {
  const daysWithActivity = new Set<string>()
  for (const s of sessions) {
    if (s.status !== 'completed' || s.endedAt === null) continue
    daysWithActivity.add(toLocalIsoDay(s.endedAt))
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
