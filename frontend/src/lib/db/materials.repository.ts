import { db } from './miga-db'
import {
  materialInputSchema,
  type Material,
  type MaterialGoalLink,
  type MaterialInput,
} from './schema'

export async function createMaterial(input: MaterialInput, goalIds: string[]): Promise<Material> {
  const parsed = materialInputSchema.parse(input)
  const now = Date.now()
  const material: Material = {
    id: crypto.randomUUID(),
    kind: parsed.kind,
    title: parsed.title,
    url: parsed.url,
    notes: parsed.notes,
    fileBlobKey: parsed.fileBlobKey,
    metadata: parsed.metadata ?? {},
    createdAt: now,
    updatedAt: now,
  }

  await db.transaction('rw', db.materials, db.materialGoalLinks, async () => {
    await db.materials.add(material)
    for (const goalId of Array.from(new Set(goalIds))) {
      const link: MaterialGoalLink = {
        id: crypto.randomUUID(),
        materialId: material.id,
        goalId,
        createdAt: now,
      }
      await db.materialGoalLinks.add(link)
    }
  })

  return material
}

export async function listMaterialsByGoal(goalId: string): Promise<Material[]> {
  const links = await db.materialGoalLinks.where('goalId').equals(goalId).toArray()
  if (links.length === 0) return []
  const ids = links.map((l) => l.materialId)
  const materials = await db.materials.where('id').anyOf(ids).toArray()
  const byId = new Map(materials.map((m) => [m.id, m]))
  return links
    .map((l) => byId.get(l.materialId))
    .filter((m): m is Material => m !== undefined)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export function listAllMaterials(): Promise<Material[]> {
  return db.materials.orderBy('createdAt').reverse().toArray()
}

export async function deleteMaterial(id: string): Promise<void> {
  await db.transaction(
    'rw',
    db.materials,
    db.materialGoalLinks,
    db.materialBlobs,
    async () => {
      await db.materialGoalLinks.where('materialId').equals(id).delete()
      await db.materialBlobs.where('materialId').equals(id).delete()
      await db.materials.delete(id)
    },
  )
}

export async function attachMaterialToGoal(materialId: string, goalId: string): Promise<void> {
  const existing = await db.materialGoalLinks
    .where('[materialId+goalId]')
    .equals([materialId, goalId])
    .first()
  if (existing) return
  const link: MaterialGoalLink = {
    id: crypto.randomUUID(),
    materialId,
    goalId,
    createdAt: Date.now(),
  }
  await db.materialGoalLinks.add(link)
}

export async function detachMaterialFromGoal(materialId: string, goalId: string): Promise<void> {
  await db.materialGoalLinks.where('[materialId+goalId]').equals([materialId, goalId]).delete()
}

export async function deleteLinksOfGoal(goalId: string): Promise<void> {
  await db.materialGoalLinks.where('goalId').equals(goalId).delete()
}
