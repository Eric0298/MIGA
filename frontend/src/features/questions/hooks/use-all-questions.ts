import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/miga-db'
import type { Question } from '@/lib/db/schema'

/**
 * Live-loads every question in the local database. Used by aggregate views
 * (stats page) that need per-goal review counters across all goals.
 */
export function useAllQuestions(): Question[] | undefined {
  return useLiveQuery(() => db.questions.toArray(), [])
}
