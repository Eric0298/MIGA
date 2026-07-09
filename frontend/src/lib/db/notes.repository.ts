import { db } from './miga-db'
import { noteInputSchema, type Note, type NoteInput } from './schema'
import { deleteNoteBlobsByNote } from './note-blobs.repository'

export type UpdateNotePatch = {
  title?: string
  text?: string
  fileBlobKey?: string
  metadata?: Note['metadata']
}

export async function createNote(input: NoteInput): Promise<Note> {
  const parsed = noteInputSchema.parse(input)
  const now = Date.now()
  const note: Note = {
    id: crypto.randomUUID(),
    goalId: parsed.goalId,
    kind: parsed.kind,
    title: parsed.title,
    text: parsed.text,
    fileBlobKey: parsed.fileBlobKey,
    metadata: parsed.metadata ?? {},
    sourceSessionId: parsed.sourceSessionId ?? null,
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
  return db.notes.where('goalId').equals(goalId).reverse().sortBy('updatedAt')
}

export async function updateNote(id: string, patch: UpdateNotePatch): Promise<void> {
  const existing = await db.notes.get(id)
  if (!existing) throw new Error('Apunte no encontrado')
  // Voice recordings and photos are immutable content-wise; only the title
  // can be renamed. To change the file the user must delete and create a new
  // note. Text and (later) document notes can update everything.
  const immutable = existing.kind === 'voice' || existing.kind === 'image'
  if (immutable && (patch.text !== undefined || patch.fileBlobKey !== undefined)) {
    throw new Error('Este tipo de apunte solo permite editar el título')
  }
  const next: Partial<Note> = { updatedAt: Date.now() }
  if (patch.title !== undefined) next.title = patch.title
  if (patch.text !== undefined) next.text = patch.text
  if (patch.fileBlobKey !== undefined) next.fileBlobKey = patch.fileBlobKey
  if (patch.metadata !== undefined) next.metadata = patch.metadata
  await db.notes.update(id, next)
}

export async function deleteNote(id: string): Promise<void> {
  await db.transaction('rw', db.notes, db.noteBlobs, async () => {
    await deleteNoteBlobsByNote(id)
    await db.notes.delete(id)
  })
}

export async function deleteNotesByGoal(goalId: string): Promise<void> {
  const notes = await listNotesByGoal(goalId)
  if (notes.length === 0) return
  const ids = notes.map((n) => n.id)
  await db.transaction('rw', db.notes, db.noteBlobs, async () => {
    for (const id of ids) {
      await deleteNoteBlobsByNote(id)
    }
    await db.notes.bulkDelete(ids)
  })
}
