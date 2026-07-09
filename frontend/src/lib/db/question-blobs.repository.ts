import { db } from './miga-db'
import type { QuestionBlob } from './schema'

export type PutQuestionBlobInput = {
  blob: Blob
  kind: 'image' | 'audio'
  mimeType?: string
  questionId?: string | null
}

/**
 * Stores a binary Blob attached to a Question (image or audio clip in the
 * prompt). Its id is persisted on Question.imageBlobKey / audioBlobKey.
 */
export async function putQuestionBlob(input: PutQuestionBlobInput): Promise<QuestionBlob> {
  const record: QuestionBlob = {
    id: crypto.randomUUID(),
    questionId: input.questionId ?? null,
    kind: input.kind,
    mimeType: input.mimeType ?? input.blob.type ?? 'application/octet-stream',
    size: input.blob.size,
    blob: input.blob,
    createdAt: Date.now(),
  }
  await db.questionBlobs.add(record)
  return record
}

export async function getQuestionBlob(id: string): Promise<QuestionBlob | null> {
  const record = await db.questionBlobs.get(id)
  return record ?? null
}

export async function deleteQuestionBlob(id: string): Promise<void> {
  await db.questionBlobs.delete(id)
}

export async function deleteQuestionBlobsByQuestion(questionId: string): Promise<void> {
  await db.questionBlobs.where('questionId').equals(questionId).delete()
}

export async function setQuestionBlobOwner(id: string, questionId: string): Promise<void> {
  await db.questionBlobs.update(id, { questionId })
}

export async function sumQuestionBlobBytes(): Promise<number> {
  const rows = await db.questionBlobs.toArray()
  return rows.reduce((sum, row) => sum + row.size, 0)
}
