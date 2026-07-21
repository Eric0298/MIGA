import { useLiveQuery } from 'dexie-react-hooks'
import { listActiveExamAttempts } from '@/lib/db/exam-attempts.repository'
import type { ExamAttempt } from '@/lib/db/schema'

/**
 * Live list of exam attempts still open (in-progress or paused), ordered
 * from oldest to newest. Used by the recovery banner on HomePage and the
 * Estudio hub to surface attempts the user forgot to close. Returns
 * undefined while the query is warming up.
 */
export function useActiveExamAttempts(): ExamAttempt[] | undefined {
  return useLiveQuery(() => listActiveExamAttempts(), [])
}
