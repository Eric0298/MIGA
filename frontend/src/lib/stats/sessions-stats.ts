import type { Session } from '@/lib/db/schema'
import { getElapsedMs } from '@/features/timer/utils'

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
