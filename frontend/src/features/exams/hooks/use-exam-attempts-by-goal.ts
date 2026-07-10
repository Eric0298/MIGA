import { useLiveQuery } from 'dexie-react-hooks'
import { listExamAttemptsByGoal } from '@/lib/db/exam-attempts.repository'

/** Live-loads every exam attempt of a goal (most recent first). */
export function useExamAttemptsByGoal(goalId: string | null | undefined) {
  return useLiveQuery(async () => {
    if (!goalId) return []
    return listExamAttemptsByGoal(goalId)
  }, [goalId])
}
