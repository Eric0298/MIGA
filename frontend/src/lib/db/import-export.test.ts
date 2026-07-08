import { afterEach, describe, expect, it } from 'vitest'
import { db } from './miga-db'
import { createGoal } from './goals.repository'
import { startSession, stopSession } from './sessions.repository'
import {
  buildExportPayload,
  clearAllData,
  EXPORT_VERSION,
  importAllData,
  parseImportPayload,
} from './import-export'

afterEach(async () => {
  await db.goals.clear()
  await db.sessions.clear()
})

describe('import-export', () => {
  it('builds an export payload with current goals and sessions', async () => {
    await createGoal({
      name: 'Estudiar',
      targetMinutes: 60,
      scheduledDays: ['2026-07-10'],
    })
    const s = await startSession({ goalId: null })
    await stopSession(s.id)

    const payload = await buildExportPayload()
    expect(payload.version).toBe(EXPORT_VERSION)
    expect(payload.goals).toHaveLength(1)
    expect(payload.sessions).toHaveLength(1)
    expect(payload.exportedAt).toBeGreaterThan(0)
  })

  it('rejects an invalid payload', () => {
    expect(() => parseImportPayload({ version: 99, goals: [], sessions: [] })).toThrow()
    expect(() => parseImportPayload({ version: 1 })).toThrow()
    expect(() => parseImportPayload(null)).toThrow()
  })

  it('completes a round trip: export -> clear -> import', async () => {
    await createGoal({ name: 'Meta A', targetMinutes: 60, scheduledDays: ['2026-07-10'] })
    await createGoal({ name: 'Meta B', targetMinutes: 90, scheduledDays: ['2026-07-11'] })
    const s = await startSession({ goalId: null })
    await stopSession(s.id)

    const payload = await buildExportPayload()
    await clearAllData()
    expect(await db.goals.count()).toBe(0)
    expect(await db.sessions.count()).toBe(0)

    const result = await importAllData(payload)
    expect(result.goalsCount).toBe(2)
    expect(result.sessionsCount).toBe(1)
    expect(await db.goals.count()).toBe(2)
    expect(await db.sessions.count()).toBe(1)
  })

  it('normalizes running or paused sessions to completed on import', async () => {
    const now = Date.now()
    const payload = parseImportPayload({
      version: 1,
      exportedAt: now,
      goals: [],
      sessions: [
        {
          id: 'sess-1',
          goalId: null,
          startedAt: now - 60_000,
          pausedAt: null,
          endedAt: null,
          totalPausedMs: 0,
          status: 'running',
          createdAt: now - 60_000,
          updatedAt: now - 60_000,
        },
      ],
    })
    const result = await importAllData(payload)
    expect(result.normalizedActiveSessions).toBe(1)

    const saved = await db.sessions.get('sess-1')
    expect(saved?.status).toBe('completed')
    expect(saved?.endedAt).not.toBeNull()
    expect(saved?.pausedAt).toBeNull()
  })

  it('bulkPut merges by id (existing rows are replaced)', async () => {
    await createGoal({ name: 'Old', targetMinutes: 60, scheduledDays: ['2026-07-10'] })
    const [existing] = await db.goals.toArray()

    const payload = parseImportPayload({
      version: 1,
      exportedAt: Date.now(),
      goals: [
        {
          ...existing,
          name: 'Updated',
          updatedAt: Date.now(),
        },
      ],
      sessions: [],
    })
    await importAllData(payload)
    const saved = await db.goals.get(existing.id)
    expect(saved?.name).toBe('Updated')
    expect(await db.goals.count()).toBe(1)
  })

  it('clearAllData empties both stores', async () => {
    await createGoal({ name: 'Meta A', targetMinutes: 60, scheduledDays: ['2026-07-10'] })
    const s = await startSession({ goalId: null })
    await stopSession(s.id)

    await clearAllData()
    expect(await db.goals.count()).toBe(0)
    expect(await db.sessions.count()).toBe(0)
  })
})
