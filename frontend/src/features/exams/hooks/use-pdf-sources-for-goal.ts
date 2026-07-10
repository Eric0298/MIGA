import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db/miga-db'
import { listMaterialsByGoal } from '@/lib/db/materials.repository'
import { listNotesByGoal } from '@/lib/db/notes.repository'
import type { Material, Note } from '@/lib/db/schema'

export type PdfSource =
  | { kind: 'material'; id: string; label: string; material: Material }
  | { kind: 'note'; id: string; label: string; note: Note }

/**
 * Aggregates every PDF that a user could pick as the source of a simulacro:
 * PDF materials linked to the goal plus document notes whose mime type is
 * application/pdf.
 */
export function usePdfSourcesForGoal(goalId: string | null | undefined): PdfSource[] {
  const result = useLiveQuery(async () => {
    if (!goalId) return []
    const [materials, notes] = await Promise.all([
      listMaterialsByGoal(goalId),
      listNotesByGoal(goalId),
    ])
    const sources: PdfSource[] = []
    for (const m of materials) {
      if (m.kind === 'pdf') {
        sources.push({ kind: 'material', id: m.id, label: m.title, material: m })
      }
    }
    for (const n of notes) {
      if (n.kind === 'document' && n.metadata?.mimeType === 'application/pdf') {
        sources.push({ kind: 'note', id: n.id, label: n.title, note: n })
      }
    }
    return sources
  }, [goalId])
  return result ?? []
}

/** Resolves an exam attempt's PDF source into a Blob usable by the viewer. */
export async function resolvePdfSourceBlob(
  materialId: string | undefined,
  noteId: string | undefined,
): Promise<Blob | null> {
  if (materialId) {
    const material = await db.materials.get(materialId)
    if (!material?.fileBlobKey) return null
    const record = await db.materialBlobs.get(material.fileBlobKey)
    return record?.blob ?? null
  }
  if (noteId) {
    const note = await db.notes.get(noteId)
    if (!note?.fileBlobKey) return null
    const record = await db.noteBlobs.get(note.fileBlobKey)
    return record?.blob ?? null
  }
  return null
}
