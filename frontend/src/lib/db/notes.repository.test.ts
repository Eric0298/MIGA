import { afterEach, describe, expect, it } from 'vitest'
import { db } from './miga-db'
import {
  createNote,
  deleteNote,
  deleteNotesByGoal,
  getNote,
  listNotesByGoal,
  updateNote,
} from './notes.repository'
import { putNoteBlob } from './note-blobs.repository'

const GOAL_A = crypto.randomUUID()
const GOAL_B = crypto.randomUUID()
const SESSION_A = crypto.randomUUID()

afterEach(async () => {
  await db.notes.clear()
  await db.noteBlobs.clear()
})

describe('notes repository', () => {
  it('creates a text note with generated id and timestamps', async () => {
    const note = await createNote({
      goalId: GOAL_A,
      kind: 'text',
      title: 'Ideas',
      text: 'Repasar el capítulo 2',
    })
    expect(note.id).toBeTypeOf('string')
    expect(note.goalId).toBe(GOAL_A)
    expect(note.kind).toBe('text')
    expect(note.text).toBe('Repasar el capítulo 2')
    expect(note.sourceSessionId).toBeNull()
    expect(note.createdAt).toBeGreaterThan(0)
    expect(note.updatedAt).toBe(note.createdAt)
  })

  it('records the source session id when the note was created inside a session', async () => {
    const note = await createNote({
      goalId: GOAL_A,
      kind: 'text',
      title: 'Ideas',
      text: 'x',
      sourceSessionId: SESSION_A,
    })
    expect(note.sourceSessionId).toBe(SESSION_A)
  })

  it('rejects a text note without text via zod', async () => {
    await expect(
      createNote({
        goalId: GOAL_A,
        kind: 'text',
        title: 'Ideas',
      }),
    ).rejects.toThrow()
  })

  it('rejects a voice note without fileBlobKey', async () => {
    await expect(
      createNote({
        goalId: GOAL_A,
        kind: 'voice',
        title: 'Grabación',
      }),
    ).rejects.toThrow()
  })

  it('rejects a document note with an unsupported mime type', async () => {
    await expect(
      createNote({
        goalId: GOAL_A,
        kind: 'document',
        title: 'Fichero',
        fileBlobKey: 'blob-1',
        metadata: { mimeType: 'image/png', fileSizeBytes: 100 },
      }),
    ).rejects.toThrow()
  })

  it('accepts pdf and docx as document mime types', async () => {
    for (const mime of [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]) {
      const note = await createNote({
        goalId: GOAL_A,
        kind: 'document',
        title: 'Fichero',
        fileBlobKey: 'blob-1',
        metadata: { mimeType: mime, fileSizeBytes: 100 },
      })
      expect(note.metadata.mimeType).toBe(mime)
    }
  })

  it('lists notes of a goal ordered by updatedAt desc', async () => {
    const first = await createNote({
      goalId: GOAL_A,
      kind: 'text',
      title: 'A',
      text: 'x',
    })
    await new Promise((r) => setTimeout(r, 5))
    const second = await createNote({
      goalId: GOAL_A,
      kind: 'text',
      title: 'B',
      text: 'x',
    })
    await createNote({ goalId: GOAL_B, kind: 'text', title: 'Other', text: 'x' })
    const list = await listNotesByGoal(GOAL_A)
    expect(list.map((n) => n.id)).toEqual([second.id, first.id])
  })

  it('updates title and text and bumps updatedAt', async () => {
    const note = await createNote({
      goalId: GOAL_A,
      kind: 'text',
      title: 'A',
      text: 'x',
    })
    const before = note.updatedAt
    await new Promise((r) => setTimeout(r, 5))
    await updateNote(note.id, { title: 'A2', text: 'y' })
    const updated = await getNote(note.id)
    expect(updated?.title).toBe('A2')
    expect(updated?.text).toBe('y')
    expect(updated?.updatedAt).toBeGreaterThan(before)
  })

  it('rejects updating the text of a voice note', async () => {
    const blob = await putNoteBlob({ blob: new Blob(['x'], { type: 'audio/webm' }) })
    const note = await createNote({
      goalId: GOAL_A,
      kind: 'voice',
      title: 'Voz',
      fileBlobKey: blob.id,
      metadata: { mimeType: 'audio/webm', fileSizeBytes: 1, durationSeconds: 5 },
    })
    await expect(updateNote(note.id, { text: 'no way' })).rejects.toThrow()
    // title-only updates are still allowed on voice notes
    await updateNote(note.id, { title: 'Voz renombrada' })
    const updated = await getNote(note.id)
    expect(updated?.title).toBe('Voz renombrada')
  })

  it('deletes a note and cascades its blob', async () => {
    const blob = await putNoteBlob({ blob: new Blob(['x'], { type: 'audio/webm' }) })
    const note = await createNote({
      goalId: GOAL_A,
      kind: 'voice',
      title: 'Voz',
      fileBlobKey: blob.id,
      metadata: { mimeType: 'audio/webm', fileSizeBytes: 1, durationSeconds: 5 },
    })
    await db.noteBlobs.update(blob.id, { noteId: note.id })
    await deleteNote(note.id)
    expect(await getNote(note.id)).toBeNull()
    expect(await db.noteBlobs.get(blob.id)).toBeUndefined()
  })

  it('deletes every note of a goal at once', async () => {
    await createNote({ goalId: GOAL_A, kind: 'text', title: 'A', text: 'x' })
    await createNote({ goalId: GOAL_A, kind: 'text', title: 'B', text: 'x' })
    await createNote({ goalId: GOAL_B, kind: 'text', title: 'C', text: 'x' })
    await deleteNotesByGoal(GOAL_A)
    expect((await listNotesByGoal(GOAL_A)).length).toBe(0)
    expect((await listNotesByGoal(GOAL_B)).length).toBe(1)
  })
})
