import { useLiveQuery } from 'dexie-react-hooks'
import { listQuestionsByGoal } from '@/lib/db/questions.repository'

/**
 * Live-loads every question that belongs to a goal, ordered by createdAt
 * ascending (older first — the order the user created them).
 */
export function useQuestionsByGoal(goalId: string | null | undefined) {
  return useLiveQuery(async () => {
    if (!goalId) return []
    return listQuestionsByGoal(goalId)
  }, [goalId])
}
