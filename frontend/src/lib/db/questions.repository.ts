import { db } from './miga-db'
import {
  questionInputSchema,
  type Question,
  type QuestionAnswer,
  type QuestionAnswerInput,
  type QuestionInput,
  type QuestionReviewState,
} from './schema'
import { deleteQuestionBlobsByQuestion } from './question-blobs.repository'

export const INITIAL_REVIEW_STATE: QuestionReviewState = {
  timesSeen: 0,
  timesCorrect: 0,
  timesIncorrect: 0,
  lastSeenAt: null,
  weight: 1,
}

export type UpdateQuestionPatch = {
  prompt?: string
  imageBlobKey?: string | null
  audioBlobKey?: string | null
  answers?: QuestionAnswerInput[]
}

function withAnswerIds(answers: QuestionInput['answers']): QuestionAnswer[] {
  return answers.map((answer) => ({
    id: answer.id ?? crypto.randomUUID(),
    text: answer.text,
    isCorrect: answer.isCorrect,
  }))
}

export async function createQuestion(input: QuestionInput): Promise<Question> {
  const parsed = questionInputSchema.parse(input)
  const now = Date.now()
  const question: Question = {
    id: crypto.randomUUID(),
    goalId: parsed.goalId,
    prompt: parsed.prompt,
    imageBlobKey: parsed.imageBlobKey,
    audioBlobKey: parsed.audioBlobKey,
    answers: withAnswerIds(parsed.answers),
    reviewState: { ...INITIAL_REVIEW_STATE },
    createdAt: now,
    updatedAt: now,
  }
  await db.questions.add(question)
  return question
}

export async function getQuestion(id: string): Promise<Question | null> {
  const record = await db.questions.get(id)
  return record ?? null
}

export function listQuestionsByGoal(goalId: string): Promise<Question[]> {
  return db.questions.where('goalId').equals(goalId).sortBy('createdAt')
}

export async function updateQuestion(id: string, patch: UpdateQuestionPatch): Promise<void> {
  const existing = await db.questions.get(id)
  if (!existing) throw new Error('Pregunta no encontrada')
  const parsed = questionInputSchema.parse({
    goalId: existing.goalId,
    prompt: patch.prompt ?? existing.prompt,
    imageBlobKey:
      patch.imageBlobKey === null ? undefined : (patch.imageBlobKey ?? existing.imageBlobKey),
    audioBlobKey:
      patch.audioBlobKey === null ? undefined : (patch.audioBlobKey ?? existing.audioBlobKey),
    answers: patch.answers ?? existing.answers,
  })
  const next: Partial<Question> = {
    prompt: parsed.prompt,
    imageBlobKey: parsed.imageBlobKey,
    audioBlobKey: parsed.audioBlobKey,
    answers: withAnswerIds(parsed.answers),
    updatedAt: Date.now(),
  }
  await db.questions.update(id, next)
}

/**
 * Overwrites the review state (SRS bookkeeping) of a question. Called by the
 * review flow after every answer. The pure computation lives in
 * `src/lib/srs/srs.ts`.
 */
export async function replaceReviewState(
  id: string,
  reviewState: QuestionReviewState,
): Promise<void> {
  await db.questions.update(id, { reviewState, updatedAt: Date.now() })
}

export async function deleteQuestion(id: string): Promise<void> {
  await db.transaction('rw', db.questions, db.questionBlobs, async () => {
    await deleteQuestionBlobsByQuestion(id)
    await db.questions.delete(id)
  })
}

export async function deleteQuestionsByGoal(goalId: string): Promise<void> {
  const questions = await listQuestionsByGoal(goalId)
  if (questions.length === 0) return
  const ids = questions.map((q) => q.id)
  await db.transaction('rw', db.questions, db.questionBlobs, async () => {
    for (const id of ids) {
      await deleteQuestionBlobsByQuestion(id)
    }
    await db.questions.bulkDelete(ids)
  })
}
