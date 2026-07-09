import { db } from './miga-db'
import type { NoteBlob } from './schema'

export type PutNoteBlobInput = {
  blob: Blob
  mimeType?: string
  noteId?: string | null
}

/**
 * Stores a binary Blob for a Note (voice recording or uploaded document) in
 * IndexedDB. The returned id is persisted as `Note.fileBlobKey`.
 */
export async function putNoteBlob(input: PutNoteBlobInput): Promise<NoteBlob> {
  const record: NoteBlob = {
    id: crypto.randomUUID(),
    noteId: input.noteId ?? null,
    mimeType: input.mimeType ?? input.blob.type ?? 'application/octet-stream',
    size: input.blob.size,
    blob: input.blob,
    createdAt: Date.now(),
  }
  await db.noteBlobs.add(record)
  return record
}

export async function getNoteBlob(id: string): Promise<NoteBlob | null> {
  const record = await db.noteBlobs.get(id)
  return record ?? null
}

export async function deleteNoteBlob(id: string): Promise<void> {
  await db.noteBlobs.delete(id)
}

export async function deleteNoteBlobsByNote(noteId: string): Promise<void> {
  await db.noteBlobs.where('noteId').equals(noteId).delete()
}

/**
 * Attaches an existing orphan blob to a note. Used when we upload/record
 * before knowing the note id (form-first flow).
 */
export async function setNoteBlobOwner(id: string, noteId: string): Promise<void> {
  await db.noteBlobs.update(id, { noteId })
}

export async function sumNoteBlobBytes(): Promise<number> {
  const rows = await db.noteBlobs.toArray()
  return rows.reduce((sum, row) => sum + row.size, 0)
}
