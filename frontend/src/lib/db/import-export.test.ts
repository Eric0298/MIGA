import { afterEach, describe, expect, it } from 'vitest'
import { db } from './miga-db'
import { createGoal, deleteGoal } from './goals.repository'
import { startSession, stopSession } from './sessions.repository'
import { attachMaterialToGoal, createMaterial, listMaterialsByGoal } from './materials.repository'
import {
  buildExportPayload,
  clearAllData,
  CURRENT_EXPORT_VERSION,
  importAllData,
  parseImportPayload,
} from './import-export'

afterEach(async () => {
  await db.goals.clear()
  await db.sessions.clear()
  await db.materials.clear()
  await db.materialGoalLinks.clear()
  await db.materialProgress.clear()
})

describe('import-export v4', () => {
  it('builds an export payload with current goals, sessions, materials and links', async () => {
    const goal = await createGoal({
      name: 'Estudiar',
      targetMinutes: 60,
      scheduledDays: ['2026-07-10'],
    })
    const s = await startSession({ goalId: null })
    await stopSession(s.id)
    await createMaterial(
      {
        kind: 'link',
        title: 'React Docs',
        url: 'https://react.dev',
        metadata: {},
      },
      [goal.id],
    )

    const payload = await buildExportPayload()
    expect(payload.version).toBe(CURRENT_EXPORT_VERSION)
    expect(payload.goals).toHaveLength(1)
    expect(payload.sessions).toHaveLength(1)
    expect(payload.materials).toHaveLength(1)
    expect(payload.materialGoalLinks).toHaveLength(1)
    expect(payload.exportedAt).toBeGreaterThan(0)
  })

  it('rejects an invalid payload', () => {
    expect(() => parseImportPayload({ version: 99, goals: [], sessions: [] })).toThrow()
    expect(() => parseImportPayload({ version: 1 })).toThrow()
    expect(() => parseImportPayload(null)).toThrow()
  })

  it('imports a legacy v1 payload with empty materials', async () => {
    const now = Date.now()
    const parsed = parseImportPayload({
      version: 1,
      exportedAt: now,
      goals: [
        {
          id: 'goal-1',
          name: 'Legacy',
          targetMinutes: 60,
          scheduledDays: ['2026-07-10'],
          createdAt: now,
          updatedAt: now,
        },
      ],
      sessions: [],
    })
    expect(parsed.version).toBe(4)
    expect(parsed.materials).toEqual([])
    expect(parsed.materialGoalLinks).toEqual([])
    expect(parsed.materialProgress).toEqual([])
    for (const s of parsed.sessions) expect(Array.isArray(s.materialIds)).toBe(true)

    const result = await importAllData(parsed)
    expect(result.goalsCount).toBe(1)
    expect(result.materialsCount).toBe(0)
    expect(result.linksCount).toBe(0)
    expect(result.progressCount).toBe(0)
  })

  it('migrates a v3 payload wrapping materialId in materialIds', async () => {
    const now = Date.now()
    const parsed = parseImportPayload({
      version: 3,
      exportedAt: now,
      goals: [],
      sessions: [
        {
          id: 'sess-1',
          goalId: null,
          materialId: 'mat-abc',
          startedAt: now,
          pausedAt: null,
          endedAt: now + 1_000,
          totalPausedMs: 0,
          status: 'completed',
          createdAt: now,
          updatedAt: now,
        },
      ],
      materials: [],
      materialGoalLinks: [],
      materialProgress: [],
    })
    expect(parsed.version).toBe(4)
    expect(parsed.sessions).toHaveLength(1)
    expect(parsed.sessions[0].materialIds).toEqual(['mat-abc'])
  })

  it('completes a v2 round trip including materials', async () => {
    const goal = await createGoal({
      name: 'Meta A',
      targetMinutes: 60,
      scheduledDays: ['2026-07-10'],
    })
    await createMaterial(
      {
        kind: 'note',
        title: 'Ideas',
        notes: 'Repasar capítulo 2',
        metadata: {},
      },
      [goal.id],
    )
    const s = await startSession({ goalId: null })
    await stopSession(s.id)

    const payload = await buildExportPayload()
    await clearAllData()
    expect(await db.materials.count()).toBe(0)
    expect(await db.materialGoalLinks.count()).toBe(0)

    const result = await importAllData(payload)
    expect(result.goalsCount).toBe(1)
    expect(result.materialsCount).toBe(1)
    expect(result.linksCount).toBe(1)
    expect(await db.materials.count()).toBe(1)
    expect(await db.materialGoalLinks.count()).toBe(1)
  })

  it('normalizes running sessions to completed on import', async () => {
    const now = Date.now()
    const parsed = parseImportPayload({
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
    const result = await importAllData(parsed)
    expect(result.normalizedActiveSessions).toBe(1)

    const saved = await db.sessions.get('sess-1')
    expect(saved?.status).toBe('completed')
    expect(saved?.endedAt).not.toBeNull()
  })

  it('clearAllData empties every store', async () => {
    const goal = await createGoal({
      name: 'Meta A',
      targetMinutes: 60,
      scheduledDays: ['2026-07-10'],
    })
    await createMaterial({ kind: 'link', title: 'Doc', url: 'https://example.org', metadata: {} }, [
      goal.id,
    ])
    const s = await startSession({ goalId: null })
    await stopSession(s.id)

    await clearAllData()
    expect(await db.goals.count()).toBe(0)
    expect(await db.sessions.count()).toBe(0)
    expect(await db.materials.count()).toBe(0)
    expect(await db.materialGoalLinks.count()).toBe(0)
  })

  it('deleting a goal cascades the material links but keeps the material', async () => {
    const goalA = await createGoal({
      name: 'Meta A',
      targetMinutes: 60,
      scheduledDays: ['2026-07-10'],
    })
    const goalB = await createGoal({
      name: 'Meta B',
      targetMinutes: 60,
      scheduledDays: ['2026-07-11'],
    })
    const material = await createMaterial(
      { kind: 'link', title: 'Doc', url: 'https://example.org', metadata: {} },
      [goalA.id],
    )
    await attachMaterialToGoal(material.id, goalB.id)

    await deleteGoal(goalA.id)
    const remainingLinks = await db.materialGoalLinks.toArray()
    expect(remainingLinks).toHaveLength(1)
    expect(remainingLinks[0].goalId).toBe(goalB.id)
    expect(await db.materials.count()).toBe(1)

    const forB = await listMaterialsByGoal(goalB.id)
    expect(forB).toHaveLength(1)
    expect(forB[0].id).toBe(material.id)
  })
})
