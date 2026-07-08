import type { Session } from '@/lib/db/schema'

export function getElapsedMs(session: Session, now: number = Date.now()): number {
  const { status, startedAt, endedAt, pausedAt, totalPausedMs } = session

  if (status === 'completed' || status === 'discarded') {
    if (endedAt === null) return 0
    return Math.max(0, endedAt - startedAt - totalPausedMs)
  }

  if (status === 'paused' && pausedAt !== null) {
    return Math.max(0, pausedAt - startedAt - totalPausedMs)
  }

  if (status === 'running') {
    return Math.max(0, now - startedAt - totalPausedMs)
  }

  return 0
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function formatShortDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  if (totalMinutes < 60) return `${totalMinutes} min`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (minutes === 0) return `${hours} h`
  return `${hours} h ${minutes} min`
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}
