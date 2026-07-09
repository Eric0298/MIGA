import { afterEach, describe, expect, it } from 'vitest'
import { db } from './miga-db'
import {
  createMaterialProgress,
  deleteProgress,
  deleteProgressOfMaterial,
  getTotalWatchedMsByMaterial,
  listAllProgress,
  listProgressByMaterial,
  sumByGoal,
} from './material-progress.repository'

afterEach(async () => {
  await db.materialProgress.clear()
})

describe('material progress repository', () => {
  it('creates a progress row with generated id and timestamps', async () => {
    const now = Date.now()
    const created = await createMaterialProgress({
      materialId: 'mat-1',
      goalId: 'goal-1',
      sessionId: 'sess-1',
      kind: 'video-youtube',
      totalWatchedMs: 5_000,
      videoRanges: [[0, 5]],
      startedAt: now,
      endedAt: now + 5_000,
    })
    expect(created.id).toBeTypeOf('string')
    expect(created.createdAt).toBeGreaterThan(0)
    expect(created.totalWatchedMs).toBe(5_000)
  })

  it('lists progress rows by material id', async () => {
    const base = Date.now()
    await createMaterialProgress({
      materialId: 'mat-1',
      goalId: null,
      sessionId: null,
      kind: 'video-youtube',
      totalWatchedMs: 3_000,
      startedAt: base,
      endedAt: base + 3_000,
    })
    await createMaterialProgress({
      materialId: 'mat-2',
      goalId: null,
      sessionId: null,
      kind: 'video-youtube',
      totalWatchedMs: 7_000,
      startedAt: base,
      endedAt: base + 7_000,
    })
    const rows = await listProgressByMaterial('mat-1')
    expect(rows).toHaveLength(1)
    expect(rows[0].totalWatchedMs).toBe(3_000)
  })

  it('sums total watched ms per material', async () => {
    const base = Date.now()
    await createMaterialProgress({
      materialId: 'mat-1',
      goalId: null,
      sessionId: null,
      kind: 'video-youtube',
      totalWatchedMs: 10_000,
      startedAt: base,
      endedAt: base + 10_000,
    })
    await createMaterialProgress({
      materialId: 'mat-1',
      goalId: null,
      sessionId: null,
      kind: 'video-youtube',
      totalWatchedMs: 25_000,
      startedAt: base,
      endedAt: base + 25_000,
    })
    expect(await getTotalWatchedMsByMaterial('mat-1')).toBe(35_000)
  })

  it('sums total watched ms per goal, ignoring other goals', async () => {
    const base = Date.now()
    await createMaterialProgress({
      materialId: 'mat-1',
      goalId: 'goal-A',
      sessionId: null,
      kind: 'video-youtube',
      totalWatchedMs: 4_000,
      startedAt: base,
      endedAt: base + 4_000,
    })
    await createMaterialProgress({
      materialId: 'mat-2',
      goalId: 'goal-A',
      sessionId: null,
      kind: 'video-youtube',
      totalWatchedMs: 6_000,
      startedAt: base,
      endedAt: base + 6_000,
    })
    await createMaterialProgress({
      materialId: 'mat-3',
      goalId: 'goal-B',
      sessionId: null,
      kind: 'video-youtube',
      totalWatchedMs: 9_000,
      startedAt: base,
      endedAt: base + 9_000,
    })
    expect(await sumByGoal('goal-A')).toBe(10_000)
    expect(await sumByGoal('goal-B')).toBe(9_000)
    expect(await sumByGoal('goal-C')).toBe(0)
  })

  it('deletes individual progress rows', async () => {
    const p = await createMaterialProgress({
      materialId: 'mat-1',
      goalId: null,
      sessionId: null,
      kind: 'video-youtube',
      totalWatchedMs: 1_000,
      startedAt: 0,
      endedAt: 1_000,
    })
    await deleteProgress(p.id)
    expect(await listAllProgress()).toEqual([])
  })

  it('deletes all progress rows for a material at once', async () => {
    for (let i = 0; i < 3; i++) {
      await createMaterialProgress({
        materialId: 'mat-1',
        goalId: null,
        sessionId: null,
        kind: 'video-youtube',
        totalWatchedMs: 1_000,
        startedAt: 0,
        endedAt: 1_000,
      })
    }
    await deleteProgressOfMaterial('mat-1')
    expect(await listAllProgress()).toEqual([])
  })
})
