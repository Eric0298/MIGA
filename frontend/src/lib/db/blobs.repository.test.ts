import { afterEach, describe, expect, it } from 'vitest'
import { db } from './miga-db'
import {
  deleteBlob,
  deleteBlobsByMaterial,
  getBlob,
  putBlob,
  setBlobMaterial,
  sumBlobBytes,
  sumBlobBytesByMaterial,
} from './blobs.repository'

afterEach(async () => {
  await db.materialBlobs.clear()
})

function makeBlob(content: string, mimeType = 'application/pdf'): Blob {
  return new Blob([content], { type: mimeType })
}

describe('blobs repository', () => {
  it('stores a blob and returns a record with generated id and metadata', async () => {
    const record = await putBlob({ blob: makeBlob('abc'), mimeType: 'application/pdf' })
    expect(record.id).toBeTypeOf('string')
    expect(record.mimeType).toBe('application/pdf')
    expect(record.size).toBe(3)
    expect(record.materialId).toBeNull()
    expect(record.createdAt).toBeGreaterThan(0)
  })

  it('falls back to blob.type when mimeType is not provided', async () => {
    const record = await putBlob({ blob: makeBlob('abc', 'video/mp4') })
    expect(record.mimeType).toBe('video/mp4')
  })

  it('retrieves a stored blob by id and preserves its size and mimetype', async () => {
    const record = await putBlob({ blob: makeBlob('hello pdf'), mimeType: 'application/pdf' })
    const fetched = await getBlob(record.id)
    expect(fetched).not.toBeNull()
    expect(fetched?.size).toBe(9)
    expect(fetched?.mimeType).toBe('application/pdf')
    expect(fetched?.blob).toBeDefined()
  })

  it('returns null when a blob does not exist', async () => {
    expect(await getBlob('missing')).toBeNull()
  })

  it('associates a blob with a material afterwards', async () => {
    const record = await putBlob({ blob: makeBlob('x') })
    await setBlobMaterial(record.id, 'mat-1')
    const fetched = await getBlob(record.id)
    expect(fetched?.materialId).toBe('mat-1')
  })

  it('deletes a blob by id', async () => {
    const record = await putBlob({ blob: makeBlob('x') })
    await deleteBlob(record.id)
    expect(await getBlob(record.id)).toBeNull()
  })

  it('deletes every blob attached to a material', async () => {
    await putBlob({ blob: makeBlob('one'), materialId: 'mat-1' })
    await putBlob({ blob: makeBlob('two'), materialId: 'mat-1' })
    await putBlob({ blob: makeBlob('other'), materialId: 'mat-2' })
    await deleteBlobsByMaterial('mat-1')
    const remaining = await db.materialBlobs.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].materialId).toBe('mat-2')
  })

  it('sums bytes across all blobs', async () => {
    await putBlob({ blob: makeBlob('aa') })
    await putBlob({ blob: makeBlob('bbbb') })
    expect(await sumBlobBytes()).toBe(6)
  })

  it('sums bytes for a specific material only', async () => {
    await putBlob({ blob: makeBlob('aa'), materialId: 'mat-1' })
    await putBlob({ blob: makeBlob('bbbb'), materialId: 'mat-1' })
    await putBlob({ blob: makeBlob('cccccc'), materialId: 'mat-2' })
    expect(await sumBlobBytesByMaterial('mat-1')).toBe(6)
    expect(await sumBlobBytesByMaterial('mat-2')).toBe(6)
    expect(await sumBlobBytesByMaterial('mat-3')).toBe(0)
  })
})
