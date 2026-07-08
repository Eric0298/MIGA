import { z } from 'zod'
import { db } from './miga-db'
import { sessionStatus, type Goal, type Session } from './schema'

const goalRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetMinutes: z.number(),
  scheduledDays: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const sessionRecordSchema = z.object({
  id: z.string(),
  goalId: z.string().nullable(),
  startedAt: z.number(),
  pausedAt: z.number().nullable(),
  endedAt: z.number().nullable(),
  totalPausedMs: z.number(),
  status: sessionStatus,
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const EXPORT_VERSION = 1

export const exportPayloadSchema = z.object({
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.number(),
  goals: z.array(goalRecordSchema),
  sessions: z.array(sessionRecordSchema),
})

export type ExportPayload = z.infer<typeof exportPayloadSchema>

export type ImportResult = {
  goalsCount: number
  sessionsCount: number
  normalizedActiveSessions: number
}

export async function buildExportPayload(): Promise<ExportPayload> {
  const [goals, sessions] = await Promise.all([db.goals.toArray(), db.sessions.toArray()])
  return {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    goals,
    sessions,
  }
}

export function parseImportPayload(raw: unknown): ExportPayload {
  return exportPayloadSchema.parse(raw)
}

export async function importAllData(payload: ExportPayload): Promise<ImportResult> {
  const now = Date.now()
  let normalizedActiveSessions = 0

  const sessions: Session[] = payload.sessions.map((s) => {
    if (s.status === 'running' || s.status === 'paused') {
      normalizedActiveSessions += 1
      return {
        ...s,
        status: 'completed',
        endedAt: s.endedAt ?? s.updatedAt ?? now,
        pausedAt: null,
      }
    }
    return s
  })

  const goals: Goal[] = payload.goals

  await db.transaction('rw', db.goals, db.sessions, async () => {
    await db.goals.bulkPut(goals)
    await db.sessions.bulkPut(sessions)
  })

  return {
    goalsCount: goals.length,
    sessionsCount: sessions.length,
    normalizedActiveSessions,
  }
}

export async function clearAllData(): Promise<void> {
  await db.transaction('rw', db.goals, db.sessions, async () => {
    await db.goals.clear()
    await db.sessions.clear()
  })
}
