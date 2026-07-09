import { useLiveQuery } from 'dexie-react-hooks'
import { listNotesByGoal } from '@/lib/db/notes.repository'

/**
 * Live-loads every note that belongs to a goal, ordered by updatedAt desc
 * (the most recently touched apuntes come first).
 */
export function useNotesByGoal(goalId: string | null | undefined) {
  return useLiveQuery(async () => {
    if (!goalId) return []
    return listNotesByGoal(goalId)
  }, [goalId])
}
