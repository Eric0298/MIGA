import type { Goal, Session } from '@/lib/db/schema'
import { filterCompletedByGoal, sumElapsedMs } from './sessions-stats'

export type GoalStatus = 'not-started' | 'on-track' | 'ahead' | 'behind' | 'complete'

export type GoalStatusResult = {
  status: GoalStatus
  actualMs: number
  expectedMs: number
  targetMs: number
  pastCompletedPlannedDays: number
  totalPlannedDays: number
}

const AHEAD_THRESHOLD = 1.1
const ON_TRACK_THRESHOLD = 0.9

export function computeGoalStatus(
  goal: Goal,
  sessions: Session[],
  todayIso: string,
): GoalStatusResult {
  const totalPlannedDays = goal.scheduledDays.length
  const targetMs = goal.targetMinutes * 60_000
  const goalSessions = filterCompletedByGoal(sessions, goal.id)
  const actualMs = sumElapsedMs(goalSessions)

  const pastCompletedPlannedDays = goal.scheduledDays.filter((d) => d < todayIso).length
  const firstPlannedDay = totalPlannedDays > 0 ? [...goal.scheduledDays].sort()[0] : null
  const hasStarted = firstPlannedDay !== null && firstPlannedDay <= todayIso

  const expectedMs =
    totalPlannedDays === 0
      ? 0
      : Math.round((pastCompletedPlannedDays / totalPlannedDays) * targetMs)

  const status = classify({
    actualMs,
    expectedMs,
    targetMs,
    hasStarted,
  })

  return {
    status,
    actualMs,
    expectedMs,
    targetMs,
    pastCompletedPlannedDays,
    totalPlannedDays,
  }
}

function classify({
  actualMs,
  expectedMs,
  targetMs,
  hasStarted,
}: {
  actualMs: number
  expectedMs: number
  targetMs: number
  hasStarted: boolean
}): GoalStatus {
  if (targetMs > 0 && actualMs >= targetMs) return 'complete'
  if (!hasStarted && actualMs === 0) return 'not-started'

  if (expectedMs === 0) {
    return actualMs > 0 ? 'ahead' : 'on-track'
  }

  const ratio = actualMs / expectedMs
  if (ratio >= AHEAD_THRESHOLD) return 'ahead'
  if (ratio >= ON_TRACK_THRESHOLD) return 'on-track'
  return 'behind'
}
