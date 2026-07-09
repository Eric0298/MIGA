import { useLiveQuery } from 'dexie-react-hooks'
import { sumByGoal } from '@/lib/db/material-progress.repository'

export function useGoalVideoWatchedMs(goalId: string | null | undefined): number {
  const total = useLiveQuery(async () => {
    if (!goalId) return 0
    return sumByGoal(goalId)
  }, [goalId])
  return total ?? 0
}
