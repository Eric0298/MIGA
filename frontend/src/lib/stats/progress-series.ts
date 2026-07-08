import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { Goal, Session } from '@/lib/db/schema'
import { fromIso } from '@/features/goals/utils'
import { filterCompletedByGoal, groupCompletedMsByDay } from './sessions-stats'

export type ProgressPoint = {
  day: string
  label: string
  plan: number
  real: number
}

export function buildProgressSeries(
  goal: Goal,
  sessions: Session[],
  todayIso: string,
): ProgressPoint[] {
  const total = goal.scheduledDays.length
  if (total === 0) return []

  const targetMinutes = goal.targetMinutes
  const sortedPlanned = [...goal.scheduledDays].sort()
  const goalSessions = filterCompletedByGoal(sessions, goal.id)
  const msByDay = groupCompletedMsByDay(goalSessions)

  const daySet = new Set<string>(sortedPlanned)
  for (const day of msByDay.keys()) daySet.add(day)
  const firstPlanned = sortedPlanned[0]
  const lastPlanned = sortedPlanned[sortedPlanned.length - 1]
  if (todayIso >= firstPlanned && todayIso <= lastPlanned) {
    daySet.add(todayIso)
  }

  const days = [...daySet].sort()
  const points: ProgressPoint[] = []
  let cumulativeReal = 0

  for (const day of days) {
    const stepMs = msByDay.get(day) ?? 0
    cumulativeReal += Math.round(stepMs / 60_000)

    const plannedUpToDay = sortedPlanned.filter((d) => d <= day).length
    const plan = Math.round((plannedUpToDay / total) * targetMinutes)

    points.push({
      day,
      label: format(fromIso(day), 'd LLL', { locale: es }),
      plan,
      real: cumulativeReal,
    })
  }

  return points
}
