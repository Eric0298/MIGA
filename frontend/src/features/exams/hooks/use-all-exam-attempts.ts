import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/miga-db'
import type { ExamAttempt } from '@/lib/db/schema'

/**
 * Live-loads every exam attempt in the local database. Used by pages that
 * aggregate exam time across all goals (HomePage, GoalsPage). Returns undefined
 * while loading.
 */
export function useAllExamAttempts(): ExamAttempt[] | undefined {
  return useLiveQuery(() => db.examAttempts.toArray(), [])
}
