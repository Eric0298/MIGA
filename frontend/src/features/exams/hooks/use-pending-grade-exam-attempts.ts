import { useLiveQuery } from 'dexie-react-hooks'
import { listPendingGradeExamAttempts } from '@/lib/db/exam-attempts.repository'
import type { ExamAttempt } from '@/lib/db/schema'

/**
 * Live list of PDF simulacros the user finished as "pending grade" and
 * hasn't scored yet, oldest first. Powers the pending-grade banner on
 * HomePage and the Estudio hub. Returns undefined while loading.
 */
export function usePendingGradeExamAttempts(): ExamAttempt[] | undefined {
  return useLiveQuery(() => listPendingGradeExamAttempts(), [])
}
