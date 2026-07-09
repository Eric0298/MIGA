import { db } from './miga-db'
import type { MaterialBlob } from './schema'

export type PutBlobInput = {
  blob: Blob
  mimeType?: string
  materialId?: string | null
}

/**
 * Stores a binary Blob in IndexedDB and returns its generated id. The id is
 * meant to be persisted as `Material.fileBlobKey` so materials never embed
 * binary data directly.
 */
export async function putBlob(input: PutBlobInput): Promise<MaterialBlob> {
  const record: MaterialBlob = {
    id: crypto.randomUUID(),
    materialId: input.materialId ?? null,
    mimeType: input.mimeType ?? input.blob.type ?? 'application/octet-stream',
    size: input.blob.size,
    blob: input.blob,
    createdAt: Date.now(),
  }
  await db.materialBlobs.add(record)
  return record
}

export async function getBlob(id: string): Promise<MaterialBlob | null> {
  const record = await db.materialBlobs.get(id)
  return record ?? null
}

export async function deleteBlob(id: string): Promise<void> {
  await db.materialBlobs.delete(id)
}

export async function deleteBlobsByMaterial(materialId: string): Promise<void> {
  await db.materialBlobs.where('materialId').equals(materialId).delete()
}

/**
 * Attaches an existing orphan blob to a material. Used when we upload a file
 * before knowing which material row it belongs to (form-first flow).
 */
export async function setBlobMaterial(id: string, materialId: string): Promise<void> {
  await db.materialBlobs.update(id, { materialId })
}

export async function sumBlobBytes(): Promise<number> {
  const rows = await db.materialBlobs.toArray()
  return rows.reduce((sum, row) => sum + row.size, 0)
}

export async function sumBlobBytesByMaterial(materialId: string): Promise<number> {
  const rows = await db.materialBlobs.where('materialId').equals(materialId).toArray()
  return rows.reduce((sum, row) => sum + row.size, 0)
}
