import { z } from 'zod'
import { db } from './miga-db'
import {
  examKind,
  examStatus,
  materialKind,
  materialMetadataSchema,
  noteKind,
  noteMetadataSchema,
  sessionStatus,
  type ExamAttempt,
  type Goal,
  type Material,
  type MaterialGoalLink,
  type MaterialProgress,
  type Note,
  type Question,
  type Session,
} from './schema'

const goalRecordSchema = z.object({
  id: z.string(),
  name: z.string(),
  targetMinutes: z.number(),
  scheduledDays: z.array(z.string()),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const sessionV1Schema = z.object({
  id: z.string(),
  goalId: z.string().nullable(),
  startedAt: z.number(),
  pausedAt: z.number().nullable(),
  endedAt: z.number().nullable(),
  totalPausedMs: z.number(),
  status: sessionStatus,
  createdAt: z.number(),
  updatedAt: z.number(),
})

const sessionV3Schema = sessionV1Schema.extend({
  materialId: z.string().nullable().optional(),
})

const sessionRecordSchema = sessionV1Schema.extend({
  materialIds: z.array(z.string()),
})

const materialRecordSchema = z.object({
  id: z.string(),
  kind: materialKind,
  title: z.string(),
  url: z.string().optional(),
  notes: z.string().optional(),
  fileBlobKey: z.string().optional(),
  metadata: materialMetadataSchema,
  createdAt: z.number(),
  updatedAt: z.number(),
})

const materialGoalLinkRecordSchema = z.object({
  id: z.string(),
  materialId: z.string(),
  goalId: z.string(),
  createdAt: z.number(),
})

const materialProgressRecordSchema = z.object({
  id: z.string(),
  materialId: z.string(),
  goalId: z.string().nullable(),
  sessionId: z.string().nullable(),
  kind: materialKind,
  totalWatchedMs: z.number(),
  videoRanges: z.array(z.tuple([z.number(), z.number()])).optional(),
  pagesRead: z.array(z.number()).optional(),
  pagesReadCounts: z.record(z.string(), z.number().int().nonnegative()).optional(),
  startedAt: z.number(),
  endedAt: z.number(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const noteRecordSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  kind: noteKind,
  title: z.string(),
  text: z.string().optional(),
  fileBlobKey: z.string().optional(),
  metadata: noteMetadataSchema,
  sourceSessionId: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const questionRecordSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  prompt: z.string(),
  imageBlobKey: z.string().optional(),
  audioBlobKey: z.string().optional(),
  answers: z.array(
    z.object({
      id: z.string(),
      text: z.string(),
      isCorrect: z.boolean(),
    }),
  ),
  reviewState: z.object({
    timesSeen: z.number().int().nonnegative(),
    timesCorrect: z.number().int().nonnegative(),
    timesIncorrect: z.number().int().nonnegative(),
    lastSeenAt: z.number().nullable(),
    weight: z.number().positive(),
  }),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const examResponseSchema = z.object({
  questionId: z.string(),
  chosenAnswerIds: z.array(z.string()),
  isCorrect: z.boolean(),
  answeredAt: z.number(),
})

const examAttemptRecordSchema = z.object({
  id: z.string(),
  goalId: z.string(),
  kind: examKind,
  title: z.string(),
  startedAt: z.number(),
  pausedAt: z.number().nullable(),
  endedAt: z.number().nullable(),
  totalPausedMs: z.number(),
  status: examStatus,
  timeLimitMs: z.number().nullable(),
  score: z.number().nullable(),
  maxScore: z.number().nullable(),
  notes: z.string(),
  pdfMaterialId: z.string().optional(),
  pdfNoteId: z.string().optional(),
  questionIds: z.array(z.string()).optional(),
  responses: z.array(examResponseSchema).optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

export const CURRENT_EXPORT_VERSION = 6

const payloadV1Schema = z.object({
  version: z.literal(1),
  exportedAt: z.number(),
  goals: z.array(goalRecordSchema),
  sessions: z.array(sessionV1Schema),
})

const payloadV2Schema = z.object({
  version: z.literal(2),
  exportedAt: z.number(),
  goals: z.array(goalRecordSchema),
  sessions: z.array(sessionV1Schema),
  materials: z.array(materialRecordSchema),
  materialGoalLinks: z.array(materialGoalLinkRecordSchema),
})

const payloadV3Schema = z.object({
  version: z.literal(3),
  exportedAt: z.number(),
  goals: z.array(goalRecordSchema),
  sessions: z.array(sessionV3Schema),
  materials: z.array(materialRecordSchema),
  materialGoalLinks: z.array(materialGoalLinkRecordSchema),
  materialProgress: z.array(materialProgressRecordSchema),
})

const payloadV4Schema = z.object({
  version: z.literal(4),
  exportedAt: z.number(),
  goals: z.array(goalRecordSchema),
  sessions: z.array(sessionRecordSchema),
  materials: z.array(materialRecordSchema),
  materialGoalLinks: z.array(materialGoalLinkRecordSchema),
  materialProgress: z.array(materialProgressRecordSchema),
})

const payloadV5Schema = z.object({
  version: z.literal(5),
  exportedAt: z.number(),
  goals: z.array(goalRecordSchema),
  sessions: z.array(sessionRecordSchema),
  materials: z.array(materialRecordSchema),
  materialGoalLinks: z.array(materialGoalLinkRecordSchema),
  materialProgress: z.array(materialProgressRecordSchema),
  notes: z.array(noteRecordSchema),
})

const payloadV6Schema = z.object({
  version: z.literal(6),
  exportedAt: z.number(),
  goals: z.array(goalRecordSchema),
  sessions: z.array(sessionRecordSchema),
  materials: z.array(materialRecordSchema),
  materialGoalLinks: z.array(materialGoalLinkRecordSchema),
  materialProgress: z.array(materialProgressRecordSchema),
  notes: z.array(noteRecordSchema),
  questions: z.array(questionRecordSchema),
  examAttempts: z.array(examAttemptRecordSchema),
})

export const exportPayloadSchema = z.union([
  payloadV1Schema,
  payloadV2Schema,
  payloadV3Schema,
  payloadV4Schema,
  payloadV5Schema,
  payloadV6Schema,
])

export type ExportPayload = z.infer<typeof payloadV6Schema>

export type ImportResult = {
  goalsCount: number
  sessionsCount: number
  materialsCount: number
  linksCount: number
  progressCount: number
  notesCount: number
  questionsCount: number
  examAttemptsCount: number
  normalizedActiveSessions: number
}

export async function buildExportPayload(): Promise<ExportPayload> {
  const [
    goals,
    sessions,
    materials,
    materialGoalLinks,
    materialProgress,
    notes,
    questions,
    examAttempts,
  ] = await Promise.all([
    db.goals.toArray(),
    db.sessions.toArray(),
    db.materials.toArray(),
    db.materialGoalLinks.toArray(),
    db.materialProgress.toArray(),
    db.notes.toArray(),
    db.questions.toArray(),
    db.examAttempts.toArray(),
  ])
  // Note blobs, material blobs and question blobs (voice recordings,
  // uploaded documents, images, audio prompts) are intentionally NOT
  // included in the backup: they can be very heavy and the JSON is meant
  // to be lightweight and portable. Restoring on another device loses the
  // raw files but keeps every entity's metadata, text and structure.
  return {
    version: CURRENT_EXPORT_VERSION,
    exportedAt: Date.now(),
    goals,
    sessions,
    materials,
    materialGoalLinks,
    materialProgress,
    notes,
    questions,
    examAttempts,
  }
}

export function parseImportPayload(raw: unknown): ExportPayload {
  const parsed = exportPayloadSchema.parse(raw)
  if (parsed.version === 1) {
    return {
      version: 6,
      exportedAt: parsed.exportedAt,
      goals: parsed.goals,
      sessions: parsed.sessions.map((s) => ({ ...s, materialIds: [] })),
      materials: [],
      materialGoalLinks: [],
      materialProgress: [],
      notes: [],
      questions: [],
      examAttempts: [],
    }
  }
  if (parsed.version === 2) {
    return {
      version: 6,
      exportedAt: parsed.exportedAt,
      goals: parsed.goals,
      sessions: parsed.sessions.map((s) => ({ ...s, materialIds: [] })),
      materials: parsed.materials,
      materialGoalLinks: parsed.materialGoalLinks,
      materialProgress: [],
      notes: [],
      questions: [],
      examAttempts: [],
    }
  }
  if (parsed.version === 3) {
    return {
      version: 6,
      exportedAt: parsed.exportedAt,
      goals: parsed.goals,
      sessions: parsed.sessions.map((s) => {
        const { materialId, ...rest } = s
        return { ...rest, materialIds: materialId ? [materialId] : [] }
      }),
      materials: parsed.materials,
      materialGoalLinks: parsed.materialGoalLinks,
      materialProgress: parsed.materialProgress,
      notes: [],
      questions: [],
      examAttempts: [],
    }
  }
  if (parsed.version === 4) {
    return {
      ...parsed,
      version: 6,
      notes: [],
      questions: [],
      examAttempts: [],
    }
  }
  if (parsed.version === 5) {
    return {
      ...parsed,
      version: 6,
      questions: [],
      examAttempts: [],
    }
  }
  return parsed
}

export async function importAllData(payload: ExportPayload): Promise<ImportResult> {
  const now = Date.now()
  let normalizedActiveSessions = 0

  const sessions: Session[] = payload.sessions.map((s) => {
    const normalized: Session = {
      ...s,
      materialIds: Array.isArray(s.materialIds) ? s.materialIds : [],
    }
    if (normalized.status === 'running' || normalized.status === 'paused') {
      normalizedActiveSessions += 1
      return {
        ...normalized,
        status: 'completed',
        endedAt: normalized.endedAt ?? normalized.updatedAt ?? now,
        pausedAt: null,
      }
    }
    return normalized
  })

  const goals: Goal[] = payload.goals
  const materials: Material[] = payload.materials
  const materialGoalLinks: MaterialGoalLink[] = payload.materialGoalLinks
  const materialProgress: MaterialProgress[] = payload.materialProgress
  const notes: Note[] = payload.notes
  const questions: Question[] = payload.questions
  const examAttempts: ExamAttempt[] = payload.examAttempts

  await db.transaction(
    'rw',
    [
      db.goals,
      db.sessions,
      db.materials,
      db.materialGoalLinks,
      db.materialProgress,
      db.notes,
      db.questions,
      db.examAttempts,
    ],
    async () => {
      await db.goals.bulkPut(goals)
      await db.sessions.bulkPut(sessions)
      await db.materials.bulkPut(materials)
      await db.materialGoalLinks.bulkPut(materialGoalLinks)
      await db.materialProgress.bulkPut(materialProgress)
      await db.notes.bulkPut(notes)
      await db.questions.bulkPut(questions)
      await db.examAttempts.bulkPut(examAttempts)
    },
  )

  return {
    goalsCount: goals.length,
    sessionsCount: sessions.length,
    materialsCount: materials.length,
    linksCount: materialGoalLinks.length,
    progressCount: materialProgress.length,
    notesCount: notes.length,
    questionsCount: questions.length,
    examAttemptsCount: examAttempts.length,
    normalizedActiveSessions,
  }
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.goals,
      db.sessions,
      db.materials,
      db.materialGoalLinks,
      db.materialProgress,
      db.materialBlobs,
      db.notes,
      db.noteBlobs,
      db.questions,
      db.questionBlobs,
      db.examAttempts,
    ],
    async () => {
      await db.goals.clear()
      await db.sessions.clear()
      await db.materials.clear()
      await db.materialGoalLinks.clear()
      await db.materialProgress.clear()
      await db.materialBlobs.clear()
      await db.notes.clear()
      await db.noteBlobs.clear()
      await db.questions.clear()
      await db.questionBlobs.clear()
      await db.examAttempts.clear()
    },
  )
}
