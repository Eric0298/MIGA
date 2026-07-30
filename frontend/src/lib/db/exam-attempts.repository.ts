import { db } from './miga-db'
import {
  EXAM_LIMITS,
  pdfExamInputSchema,
  questionsExamInputSchema,
  type ExamAttempt,
  type ExamResponse,
  type PdfExamInput,
  type QuestionsExamInput,
} from './schema'
import { z } from 'zod'

const notesSchema = z.string().max(EXAM_LIMITS.notes.maxChars)
const scorePairSchema = z
  .object({
    score: z.number().finite().min(0).nullable(),
    maxScore: z.number().finite().min(0).nullable(),
    notes: notesSchema.optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (
      (data.score === null) !== (data.maxScore === null) ||
      (data.score !== null && data.maxScore !== null && data.score > data.maxScore)
    ) {
      ctx.addIssue({ code: 'custom', message: 'invalidScore', path: ['score'] })
    }
  })

const responseSchema = z
  .object({
    questionId: z.uuid(),
    chosenAnswerIds: z.array(z.uuid()).max(10),
    isCorrect: z.boolean(),
    answeredAt: z.number().int().min(0),
  })
  .strict()

const finishQuestionsSchema = z
  .object({
    responses: z.array(responseSchema).max(EXAM_LIMITS.questions.maxCount),
    notes: notesSchema.optional(),
  })
  .strict()

/**
 * Creates a new PDF simulacro attempt in 'in-progress' state. The user grades
 * it later (or leaves it 'pending-grade' and grades from the pending screen).
 */
export async function startPdfExamAttempt(input: PdfExamInput): Promise<ExamAttempt> {
  const parsed = pdfExamInputSchema.parse(input)
  const now = Date.now()
  const attempt: ExamAttempt = {
    id: crypto.randomUUID(),
    goalId: parsed.goalId,
    kind: 'pdf',
    title: parsed.title,
    startedAt: now,
    pausedAt: null,
    endedAt: null,
    totalPausedMs: 0,
    status: 'in-progress',
    timeLimitMs: parsed.timeLimitMs ?? null,
    score: null,
    maxScore: null,
    notes: '',
    pdfMaterialId: parsed.pdfMaterialId,
    pdfNoteId: parsed.pdfNoteId,
    createdAt: now,
    updatedAt: now,
  }
  await db.examAttempts.add(attempt)
  return attempt
}

/**
 * Creates a new question-based exam attempt in 'in-progress' state. The pool
 * is snapshot at creation time so subsequent question edits do not distort
 * the attempt.
 */
export async function startQuestionsExamAttempt(input: QuestionsExamInput): Promise<ExamAttempt> {
  const parsed = questionsExamInputSchema.parse(input)
  const now = Date.now()
  const attempt: ExamAttempt = {
    id: crypto.randomUUID(),
    goalId: parsed.goalId,
    kind: 'questions',
    title: parsed.title,
    startedAt: now,
    pausedAt: null,
    endedAt: null,
    totalPausedMs: 0,
    status: 'in-progress',
    timeLimitMs: parsed.timeLimitMs ?? null,
    score: 0,
    maxScore: parsed.questionIds.length,
    notes: '',
    questionIds: parsed.questionIds,
    responses: [],
    createdAt: now,
    updatedAt: now,
  }
  await db.examAttempts.add(attempt)
  return attempt
}

export async function getExamAttempt(id: string): Promise<ExamAttempt | null> {
  const record = await db.examAttempts.get(id)
  return record ?? null
}

export function listExamAttemptsByGoal(goalId: string): Promise<ExamAttempt[]> {
  return db.examAttempts.where('goalId').equals(goalId).reverse().sortBy('startedAt')
}

/**
 * Returns every attempt still open (in-progress or paused), ordered from
 * oldest to newest by `startedAt`. Used by the recovery banner to surface
 * exams the user abandoned and hasn't resumed. Discarded, graded and
 * completed attempts are excluded.
 */
export function listActiveExamAttempts(): Promise<ExamAttempt[]> {
  return db.examAttempts.where('status').anyOf('in-progress', 'paused').sortBy('startedAt')
}

/**
 * PDF simulations the user finished as "grade later" and hasn't graded yet.
 * Ordered oldest → newest by `endedAt`. Only PDF attempts reach the
 * `pending-grade` status; question-based attempts auto-grade on finish.
 */
export function listPendingGradeExamAttempts(): Promise<ExamAttempt[]> {
  return db.examAttempts.where('status').equals('pending-grade').sortBy('endedAt')
}

export async function pauseExamAttempt(id: string): Promise<void> {
  const attempt = await db.examAttempts.get(id)
  if (!attempt) throw new Error('Intento no encontrado')
  if (attempt.status !== 'in-progress') throw new Error('El intento no está en curso')
  const now = Date.now()
  await db.examAttempts.update(id, {
    status: 'paused',
    pausedAt: now,
    updatedAt: now,
  })
}

export async function resumeExamAttempt(id: string): Promise<void> {
  const attempt = await db.examAttempts.get(id)
  if (!attempt) throw new Error('Intento no encontrado')
  if (attempt.status !== 'paused' || attempt.pausedAt === null) {
    throw new Error('El intento no está pausado')
  }
  const now = Date.now()
  const additionalPaused = now - attempt.pausedAt
  await db.examAttempts.update(id, {
    status: 'in-progress',
    pausedAt: null,
    totalPausedMs: attempt.totalPausedMs + additionalPaused,
    updatedAt: now,
  })
}

export type FinishPdfExamOptions = {
  score: number | null
  maxScore: number | null
  notes?: string
}

/**
 * Ends a PDF simulacro. Pass `score = null` to leave it 'pending-grade';
 * pass a number to close it as 'graded'. In both cases the timer stops.
 */
export async function finishPdfExamAttempt(
  id: string,
  options: FinishPdfExamOptions,
): Promise<void> {
  const parsedOptions = scorePairSchema.parse(options)
  const attempt = await db.examAttempts.get(id)
  if (!attempt) throw new Error('Intento no encontrado')
  if (attempt.kind !== 'pdf') throw new Error('Solo aplica a simulacros PDF')
  if (attempt.status !== 'in-progress' && attempt.status !== 'paused') {
    throw new Error('El intento ya no está activo')
  }
  const now = Date.now()
  const extraPause =
    attempt.status === 'paused' && attempt.pausedAt !== null ? now - attempt.pausedAt : 0
  await db.examAttempts.update(id, {
    status: parsedOptions.score === null ? 'pending-grade' : 'graded',
    score: parsedOptions.score,
    maxScore: parsedOptions.maxScore,
    notes: parsedOptions.notes ?? attempt.notes,
    endedAt: now,
    pausedAt: null,
    totalPausedMs: attempt.totalPausedMs + extraPause,
    updatedAt: now,
  })
}

/** Grades a previously-pending PDF simulacro. */
export async function gradePdfExamAttempt(
  id: string,
  score: number,
  maxScore: number,
  notes?: string,
): Promise<void> {
  scorePairSchema.parse({ score, maxScore, notes })
  const attempt = await db.examAttempts.get(id)
  if (!attempt) throw new Error('Intento no encontrado')
  if (attempt.kind !== 'pdf') throw new Error('Solo aplica a simulacros PDF')
  const now = Date.now()
  await db.examAttempts.update(id, {
    status: 'graded',
    score,
    maxScore,
    notes: notes ?? attempt.notes,
    updatedAt: now,
  })
}

export type FinishQuestionsExamOptions = {
  responses: ExamResponse[]
  notes?: string
}

/** Ends a questions exam and auto-computes the score from the responses. */
export async function finishQuestionsExamAttempt(
  id: string,
  options: FinishQuestionsExamOptions,
): Promise<void> {
  const parsedOptions = finishQuestionsSchema.parse(options)
  const attempt = await db.examAttempts.get(id)
  if (!attempt) throw new Error('Intento no encontrado')
  if (attempt.kind !== 'questions') throw new Error('Solo aplica a exámenes con preguntas')
  if (attempt.status !== 'in-progress' && attempt.status !== 'paused') {
    throw new Error('El intento ya no está activo')
  }
  const now = Date.now()
  const extraPause =
    attempt.status === 'paused' && attempt.pausedAt !== null ? now - attempt.pausedAt : 0
  const allowedQuestionIds = new Set(attempt.questionIds ?? [])
  if (parsedOptions.responses.some((response) => !allowedQuestionIds.has(response.questionId))) {
    throw new Error('La respuesta no pertenece a este examen')
  }
  const score = parsedOptions.responses.filter((r) => r.isCorrect).length
  await db.examAttempts.update(id, {
    status: 'completed',
    score,
    responses: parsedOptions.responses,
    notes: parsedOptions.notes ?? attempt.notes,
    endedAt: now,
    pausedAt: null,
    totalPausedMs: attempt.totalPausedMs + extraPause,
    updatedAt: now,
  })
}

/** Updates only the notes of an exam attempt. Used from the results screen. */
export async function updateExamAttemptNotes(id: string, notes: string): Promise<void> {
  const parsedNotes = notesSchema.parse(notes)
  const updated = await db.examAttempts.update(id, { notes: parsedNotes, updatedAt: Date.now() })
  if (updated === 0) throw new Error('Intento no encontrado')
}

export async function discardExamAttempt(id: string): Promise<void> {
  const attempt = await db.examAttempts.get(id)
  if (!attempt) throw new Error('Intento no encontrado')
  const now = Date.now()
  await db.examAttempts.update(id, {
    status: 'discarded',
    endedAt: attempt.endedAt ?? now,
    pausedAt: null,
    updatedAt: now,
  })
}

export async function deleteExamAttempt(id: string): Promise<void> {
  await db.examAttempts.delete(id)
}

export async function deleteExamAttemptsByGoal(goalId: string): Promise<void> {
  await db.examAttempts.where('goalId').equals(goalId).delete()
}

/**
 * Duration counted toward the goal for a finished attempt. Discarded and
 * in-progress attempts contribute 0 so stats only reflect actual exam time.
 */
export function getExamElapsedMs(attempt: ExamAttempt, now: number = Date.now()): number {
  const active = attempt.status === 'in-progress' || attempt.status === 'paused'
  if (attempt.status === 'discarded') return 0
  if (active) {
    if (attempt.status === 'paused' && attempt.pausedAt !== null) {
      return Math.max(0, attempt.pausedAt - attempt.startedAt - attempt.totalPausedMs)
    }
    return Math.max(0, now - attempt.startedAt - attempt.totalPausedMs)
  }
  if (attempt.endedAt === null) return 0
  return Math.max(0, attempt.endedAt - attempt.startedAt - attempt.totalPausedMs)
}
