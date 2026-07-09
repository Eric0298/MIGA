import { db } from './miga-db'
import type { MaterialKind, MaterialProgress, VideoRange } from './schema'

export type CreateMaterialProgressInput = {
  materialId: string
  goalId: string | null
  sessionId: string | null
  kind: MaterialKind
  totalWatchedMs: number
  videoRanges?: VideoRange[]
  pagesRead?: number[]
  pagesReadCounts?: Record<string, number>
  startedAt: number
  endedAt: number
}

export async function createMaterialProgress(
  input: CreateMaterialProgressInput,
): Promise<MaterialProgress> {
  const now = Date.now()
  const record: MaterialProgress = {
    id: crypto.randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  }
  await db.materialProgress.add(record)
  return record
}

export function listProgressByMaterial(materialId: string): Promise<MaterialProgress[]> {
  return db.materialProgress.where('materialId').equals(materialId).toArray()
}

export async function getTotalWatchedMsByMaterial(materialId: string): Promise<number> {
  const rows = await listProgressByMaterial(materialId)
  return rows.reduce((sum, row) => sum + row.totalWatchedMs, 0)
}

export async function sumByGoal(goalId: string): Promise<number> {
  const rows = await db.materialProgress.where('goalId').equals(goalId).toArray()
  return rows.reduce((sum, row) => sum + row.totalWatchedMs, 0)
}

export function listAllProgress(): Promise<MaterialProgress[]> {
  return db.materialProgress.toArray()
}

export async function deleteProgress(id: string): Promise<void> {
  await db.materialProgress.delete(id)
}

export async function deleteProgressOfMaterial(materialId: string): Promise<void> {
  await db.materialProgress.where('materialId').equals(materialId).delete()
}
