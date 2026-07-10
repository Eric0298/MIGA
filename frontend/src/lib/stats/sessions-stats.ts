import type { ExamAttempt, Session } from '@/lib/db/schema'
import { getElapsedMs } from '@/features/timer/utils'
import { getExamElapsedMs } from '@/lib/db/exam-attempts.repository'

export function toLocalIsoDay(epochMs: number): string {
  const d = new Date(epochMs)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function filterCompletedByDay(sessions: Session[], dayIso: string): Session[] {
  return sessions.filter((s) => {
    if (s.status !== 'completed' || s.endedAt === null) return false
    return toLocalIsoDay(s.endedAt) === dayIso
  })
}

export function filterCompletedByGoal(sessions: Session[], goalId: string): Session[] {
  return sessions.filter((s) => s.status === 'completed' && s.goalId === goalId)
}

export function sumElapsedMs(sessions: Session[]): number {
  return sessions.reduce((sum, s) => sum + getElapsedMs(s), 0)
}

export function groupCompletedMsByDay(sessions: Session[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const s of sessions) {
    if (s.status !== 'completed' || s.endedAt === null) continue
    const day = toLocalIsoDay(s.endedAt)
    const current = map.get(day) ?? 0
    map.set(day, current + getElapsedMs(s))
  }
  return map
}

/**
 * Exam attempts that contribute time to a goal — i.e. finished attempts,
 * regardless of pdf/questions kind. Discarded and still-active attempts are
 * excluded because their time is not counted toward progress.
 */
export function filterFinishedExamsByGoal(
  attempts: ExamAttempt[],
  goalId: string,
): ExamAttempt[] {
  return attempts.filter(
    (a) =>
      a.goalId === goalId &&
      a.endedAt !== null &&
      a.status !== 'discarded' &&
      a.status !== 'in-progress' &&
      a.status !== 'paused',
  )
}

export function sumExamElapsedMs(attempts: ExamAttempt[]): number {
  return attempts.reduce((sum, a) => sum + getExamElapsedMs(a), 0)
}

/** Groups exam-attempt time by the day the attempt finished. */
export function groupExamMsByDay(attempts: ExamAttempt[]): Map<string, number> {
  const map = new Map<string, number>()
  for (const a of attempts) {
    if (a.endedAt === null || a.status === 'discarded') continue
    const day = toLocalIsoDay(a.endedAt)
    const current = map.get(day) ?? 0
    map.set(day, current + getExamElapsedMs(a))
  }
  return map
}
