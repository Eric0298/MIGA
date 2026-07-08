import type { Goal } from '@/lib/db/schema'

export type UpcomingPlan = {
  goal: Goal
  day: string
}

export function findNextPlannedDay(goals: Goal[], todayIso: string): UpcomingPlan | null {
  let best: UpcomingPlan | null = null
  for (const goal of goals) {
    for (const day of goal.scheduledDays) {
      if (day < todayIso) continue
      if (best === null || day < best.day) {
        best = { goal, day }
      }
    }
  }
  return best
}
