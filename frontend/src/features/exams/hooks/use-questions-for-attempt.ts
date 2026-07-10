import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/miga-db'
import type { Question } from '@/lib/db/schema'

/**
 * Loads the questions that back a questions-based exam attempt, preserving the
 * order that was snapshot at creation time. Returns undefined while loading and
 * an empty array if no ids are provided.
 */
export function useQuestionsForAttempt(
  questionIds: readonly string[] | undefined,
): Question[] | undefined {
  return useLiveQuery(async () => {
    if (!questionIds || questionIds.length === 0) return []
    const rows = await db.questions.bulkGet([...questionIds])
    return questionIds
      .map((id) => rows.find((r) => r?.id === id))
      .filter((q): q is Question => Boolean(q))
  }, [questionIds?.join('|') ?? ''])
}
