import { db } from './miga-db'
import {
  noteInputSchema,
  type Note,
  type NoteInput,
  type NoteSource,
} from './schema'
import { deleteNoteBlobsByNote } from './note-blobs.repository'

export type UpdateNotePatch = {
  title?: string
  text?: string
  fileBlobKey?: string
  metadata?: Note['metadata']
  goalIds?: string[]
}

export async function createNote(input: NoteInput): Promise<Note> {
  const parsed = noteInputSchema.parse(input)
  const now = Date.now()
  const source: NoteSource =
    parsed.source ?? (parsed.sourceSessionId ? 'session' : 'manual')
  const note: Note = {
    id: crypto.randomUUID(),
    goalIds: parsed.goalIds,
    kind: parsed.kind,
    title: parsed.title,
    text: parsed.text,
    fileBlobKey: parsed.fileBlobKey,
    metadata: parsed.metadata ?? {},
    sourceSessionId: parsed.sourceSessionId ?? null,
    source,
    createdAt: now,
    updatedAt: now,
  }
  await db.notes.add(note)
  return note
}

export async function getNote(id: string): Promise<Note | null> {
  const record = await db.notes.get(id)
  return record ?? null
}

export function listNotesByGoal(goalId: string): Promise<Note[]> {
  // `goalIds` is a multi-entry index in v10, so this equality lookup returns
  // every note that has `goalId` anywhere in the array.
  return db.notes.where('goalIds').equals(goalId).reverse().sortBy('updatedAt')
}

export function listAllNotes(): Promise<Note[]> {
  return db.notes.orderBy('updatedAt').reverse().toArray()
}

export async function updateNote(id: string, patch: UpdateNotePatch): Promise<void> {
  const existing = await db.notes.get(id)
  if (!existing) throw new Error('Apunte no encontrado')
  // Voice recordings and photos are immutable content-wise; only the title
  // (and the goal assignment) can change. To swap the file the user must
  // delete and create a new note.
  const immutable = existing.kind === 'voice' || existing.kind === 'image'
  if (immutable && (patch.text !== undefined || patch.fileBlobKey !== undefined)) {
    throw new Error('Este tipo de apunte solo permite editar el título')
  }
  const next: Partial<Note> = { updatedAt: Date.now() }
  if (patch.title !== undefined) next.title = patch.title
  if (patch.text !== undefined) next.text = patch.text
  if (patch.fileBlobKey !== undefined) next.fileBlobKey = patch.fileBlobKey
  if (patch.metadata !== undefined) next.metadata = patch.metadata
  if (patch.goalIds !== undefined) {
    if (patch.goalIds.length === 0) {
      throw new Error('Una nota debe pertenecer al menos a una meta')
    }
    next.goalIds = patch.goalIds
  }
  await db.notes.update(id, next)
}

export async function deleteNote(id: string): Promise<void> {
  await db.transaction('rw', db.notes, db.noteBlobs, async () => {
    await deleteNoteBlobsByNote(id)
    await db.notes.delete(id)
  })
}

/**
 * Called when a goal is being deleted. Any note pinned to that goal loses
 * the link; notes that are shared with other goals stay alive, notes that
 * become orphan get deleted along with their blobs.
 */
export async function deleteNotesByGoal(goalId: string): Promise<void> {
  const notes = await listNotesByGoal(goalId)
  if (notes.length === 0) return
  const toDelete: string[] = []
  const toUnlink: Array<{ id: string; goalIds: string[] }> = []
  for (const note of notes) {
    const remaining = note.goalIds.filter((g) => g !== goalId)
    if (remaining.length === 0) {
      toDelete.push(note.id)
    } else {
      toUnlink.push({ id: note.id, goalIds: remaining })
    }
  }
  await db.transaction('rw', db.notes, db.noteBlobs, async () => {
    for (const id of toDelete) {
      await deleteNoteBlobsByNote(id)
    }
    if (toDelete.length > 0) await db.notes.bulkDelete(toDelete)
    for (const { id, goalIds } of toUnlink) {
      await db.notes.update(id, { goalIds, updatedAt: Date.now() })
    }
  })
}
