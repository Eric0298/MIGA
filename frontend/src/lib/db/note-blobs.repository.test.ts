import { afterEach, describe, expect, it } from 'vitest'
import { db } from './miga-db'
import {
  deleteNoteBlob,
  deleteNoteBlobsByNote,
  getNoteBlob,
  putNoteBlob,
  setNoteBlobOwner,
  sumNoteBlobBytes,
} from './note-blobs.repository'

afterEach(async () => {
  await db.noteBlobs.clear()
})

function makeBlob(content: string, mimeType = 'audio/webm'): Blob {
  return new Blob([content], { type: mimeType })
}

describe('noteBlobs repository', () => {
  it('stores a blob with generated id and metadata', async () => {
    const record = await putNoteBlob({ blob: makeBlob('abc'), mimeType: 'audio/webm' })
    expect(record.id).toBeTypeOf('string')
    expect(record.mimeType).toBe('audio/webm')
    expect(record.size).toBe(3)
    expect(record.noteId).toBeNull()
    expect(record.createdAt).toBeGreaterThan(0)
  })

  it('sets the note owner after the fact', async () => {
    const record = await putNoteBlob({ blob: makeBlob('x') })
    await setNoteBlobOwner(record.id, 'note-1')
    const fetched = await getNoteBlob(record.id)
    expect(fetched?.noteId).toBe('note-1')
  })

  it('deletes every blob of a note in one call', async () => {
    await putNoteBlob({ blob: makeBlob('one'), noteId: 'note-1' })
    await putNoteBlob({ blob: makeBlob('two'), noteId: 'note-1' })
    await putNoteBlob({ blob: makeBlob('other'), noteId: 'note-2' })
    await deleteNoteBlobsByNote('note-1')
    const remaining = await db.noteBlobs.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].noteId).toBe('note-2')
  })

  it('deletes a blob by id', async () => {
    const record = await putNoteBlob({ blob: makeBlob('x') })
    await deleteNoteBlob(record.id)
    expect(await getNoteBlob(record.id)).toBeNull()
  })

  it('sums bytes across all blobs', async () => {
    await putNoteBlob({ blob: makeBlob('aa') })
    await putNoteBlob({ blob: makeBlob('bbbb') })
    expect(await sumNoteBlobBytes()).toBe(6)
  })
})
