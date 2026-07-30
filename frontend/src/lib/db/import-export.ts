import { z } from 'zod'
import { assertSnapshotSize, MAX_HTTP_URL_CHARS, SNAPSHOT_LIMITS } from './data-limits'
import { db, type MigaDatabase, type WorkspaceSyncMetadata } from './miga-db'
import {
  examKind,
  examStatus,
  MATERIAL_LIMITS,
  materialKind,
  NOTE_LIMITS,
  noteKind,
  noteSource,
  sessionStatus,
  type ExamAttempt,
  type Goal,
  type Material,
  type MaterialGoalLink,
  type MaterialProgress,
  type Note,
  type NoteSource,
  type Question,
  type Session,
} from './schema'

export { SNAPSHOT_LIMITS } from './data-limits'
const MAX_TEXT_CHARS = 50_000
const MAX_SAFE_TIMESTAMP = 8_640_000_000_000
const uuid = z.string().uuid()
const timestamp = z.number().int().min(0).max(MAX_SAFE_TIMESTAMP)
const nonNegativeInteger = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const dayIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((raw) => {
    const [year, month, day] = raw.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    )
  })
const httpUrl = z
  .string()
  .max(MAX_HTTP_URL_CHARS)
  .refine((raw) => {
    try {
      if (raw.includes('\\')) return false
      const parsed = new URL(raw)
      return (
        (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
        parsed.username === '' &&
        parsed.password === ''
      )
    } catch {
      return false
    }
  })

const goalRecordSchema = z
  .object({
    id: uuid,
    name: z.string().trim().min(2).max(60),
    targetMinutes: z
      .number()
      .int()
      .min(15)
      .max(60 * 24 * 365),
    scheduledDays: z.array(dayIso).min(1).max(SNAPSHOT_LIMITS.scheduledDaysPerGoal),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict()

const sessionV1Schema = z
  .object({
    id: uuid,
    goalId: uuid.nullable(),
    startedAt: timestamp,
    pausedAt: timestamp.nullable(),
    endedAt: timestamp.nullable(),
    totalPausedMs: nonNegativeInteger,
    status: sessionStatus,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict()

const sessionV3Schema = sessionV1Schema.extend({
  materialId: z.string().nullable().optional(),
})

const sessionRecordSchema = sessionV1Schema
  .extend({
    materialIds: z.array(uuid).max(SNAPSHOT_LIMITS.materialsPerSession),
  })
  .strict()

const materialMetadataRecordSchema = z
  .object({
    provider: z.enum(['youtube', 'upload', 'pdf']).optional(),
    youtubeVideoId: z
      .string()
      .regex(/^[A-Za-z0-9_-]{11}$/)
      .optional(),
    thumbnailUrl: httpUrl.optional(),
    author: z.string().trim().max(200).optional(),
    durationSeconds: nonNegativeInteger.max(60 * 60 * 24 * 365).optional(),
    totalPages: z.number().int().min(1).max(100_000).optional(),
    mimeType: z.string().max(200).optional(),
    fileSizeBytes: nonNegativeInteger.max(500 * 1024 * 1024).optional(),
  })
  .strict()

const materialRecordSchema = z
  .object({
    id: uuid,
    kind: materialKind,
    title: z.string().trim().min(1).max(80),
    url: httpUrl.optional(),
    notes: z.string().max(500).optional(),
    fileBlobKey: uuid.optional(),
    metadata: materialMetadataRecordSchema,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict()
  .superRefine((data, ctx) => {
    if ((data.kind === 'link' || data.kind === 'video-youtube') && !data.url) {
      ctx.addIssue({ code: 'custom', path: ['url'], message: 'urlRequired' })
    }
    if (data.kind === 'note' && !data.notes?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['notes'], message: 'notesRequired' })
    }
    if ((data.kind === 'video-upload' || data.kind === 'pdf') && !data.fileBlobKey) {
      ctx.addIssue({ code: 'custom', path: ['fileBlobKey'], message: 'fileRequired' })
    }
    if (data.kind === 'pdf') {
      const { fileSizeBytes, mimeType } = data.metadata
      if (
        mimeType !== undefined &&
        !MATERIAL_LIMITS.pdf.mimeTypes.includes(mimeType as 'application/pdf')
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['metadata', 'mimeType'],
          message: 'fileInvalidType',
        })
      }
      if (fileSizeBytes !== undefined && fileSizeBytes > MATERIAL_LIMITS.pdf.maxBytes) {
        ctx.addIssue({
          code: 'custom',
          path: ['metadata', 'fileSizeBytes'],
          message: 'fileTooLarge',
        })
      }
    }
    if (data.kind === 'video-upload') {
      const { fileSizeBytes, mimeType } = data.metadata
      if (
        mimeType !== undefined &&
        !mimeType.startsWith(MATERIAL_LIMITS.videoUpload.mimeTypePrefix)
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['metadata', 'mimeType'],
          message: 'fileInvalidType',
        })
      }
      if (fileSizeBytes !== undefined && fileSizeBytes > MATERIAL_LIMITS.videoUpload.maxBytes) {
        ctx.addIssue({
          code: 'custom',
          path: ['metadata', 'fileSizeBytes'],
          message: 'fileTooLarge',
        })
      }
    }
  })

const materialGoalLinkRecordSchema = z
  .object({
    id: uuid,
    materialId: uuid,
    goalId: uuid,
    createdAt: timestamp,
  })
  .strict()

const materialProgressRecordSchema = z
  .object({
    id: uuid,
    materialId: uuid,
    goalId: uuid.nullable(),
    sessionId: uuid.nullable(),
    kind: materialKind,
    totalWatchedMs: nonNegativeInteger,
    videoRanges: z
      .array(z.tuple([z.number().finite().min(0), z.number().finite().min(0)]))
      .max(SNAPSHOT_LIMITS.videoRangesPerProgress)
      .optional(),
    pagesRead: z
      .array(z.number().int().min(1).max(100_000))
      .max(SNAPSHOT_LIMITS.pagesPerProgress)
      .optional(),
    pagesReadCounts: z
      .record(z.string().regex(/^\d{1,6}$/), z.number().int().min(0).max(1_000_000))
      .refine(
        (counts) => Object.keys(counts).length <= SNAPSHOT_LIMITS.pagesPerProgress,
        'tooManyPageCounts',
      )
      .refine(
        (counts) => Object.keys(counts).every((page) => Number(page) <= 100_000),
        'pageOutOfRange',
      )
      .optional(),
    startedAt: timestamp,
    endedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict()

const noteMetadataRecordSchema = z
  .object({
    mimeType: z.string().max(200).optional(),
    fileSizeBytes: nonNegativeInteger.max(25 * 1024 * 1024).optional(),
    durationSeconds: z
      .number()
      .finite()
      .min(0)
      .max(15 * 60)
      .optional(),
    originalFilename: z.string().max(255).optional(),
  })
  .strict()

const noteV5RecordSchema = z
  .object({
    id: uuid,
    goalId: uuid,
    kind: noteKind,
    title: z.string().trim().min(1).max(80),
    text: z.string().max(MAX_TEXT_CHARS).optional(),
    fileBlobKey: uuid.optional(),
    metadata: noteMetadataRecordSchema,
    sourceSessionId: uuid.nullable(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict()

const noteRecordSchema = z
  .object({
    id: uuid,
    goalIds: z.array(uuid).min(1).max(SNAPSHOT_LIMITS.goalsPerNote),
    kind: noteKind,
    title: z.string().trim().min(1).max(80),
    text: z.string().max(MAX_TEXT_CHARS).optional(),
    fileBlobKey: uuid.optional(),
    metadata: noteMetadataRecordSchema,
    sourceSessionId: uuid.nullable(),
    source: noteSource,
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.kind === 'text' && !data.text?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['text'], message: 'textRequired' })
    }
    if (data.kind !== 'text' && !data.fileBlobKey) {
      ctx.addIssue({ code: 'custom', path: ['fileBlobKey'], message: 'fileRequired' })
    }
    if (data.kind === 'voice') {
      const { fileSizeBytes, mimeType } = data.metadata
      if (mimeType !== undefined && !mimeType.startsWith(NOTE_LIMITS.voice.mimeTypePrefix)) {
        ctx.addIssue({
          code: 'custom',
          path: ['metadata', 'mimeType'],
          message: 'fileInvalidType',
        })
      }
      if (fileSizeBytes !== undefined && fileSizeBytes > NOTE_LIMITS.voice.maxBytes) {
        ctx.addIssue({
          code: 'custom',
          path: ['metadata', 'fileSizeBytes'],
          message: 'fileTooLarge',
        })
      }
    }
    if (data.kind === 'document') {
      const { fileSizeBytes, mimeType } = data.metadata
      if (
        mimeType !== undefined &&
        !NOTE_LIMITS.document.mimeTypes.includes(
          mimeType as (typeof NOTE_LIMITS.document.mimeTypes)[number],
        )
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['metadata', 'mimeType'],
          message: 'fileInvalidType',
        })
      }
      if (fileSizeBytes !== undefined && fileSizeBytes > NOTE_LIMITS.document.maxBytes) {
        ctx.addIssue({
          code: 'custom',
          path: ['metadata', 'fileSizeBytes'],
          message: 'fileTooLarge',
        })
      }
    }
    if (data.kind === 'image') {
      const { fileSizeBytes, mimeType } = data.metadata
      if (
        mimeType !== undefined &&
        !NOTE_LIMITS.image.mimeTypes.includes(
          mimeType as (typeof NOTE_LIMITS.image.mimeTypes)[number],
        )
      ) {
        ctx.addIssue({
          code: 'custom',
          path: ['metadata', 'mimeType'],
          message: 'fileInvalidType',
        })
      }
      if (fileSizeBytes !== undefined && fileSizeBytes > NOTE_LIMITS.image.maxBytes) {
        ctx.addIssue({
          code: 'custom',
          path: ['metadata', 'fileSizeBytes'],
          message: 'fileTooLarge',
        })
      }
    }
  })

function inferNoteSource(sourceSessionId: string | null, title: string): NoteSource {
  if (sourceSessionId) return 'session'
  if (title.startsWith('Repaso · ')) return 'exam'
  return 'manual'
}

const questionAnswerRecordSchema = z
  .object({
    id: uuid,
    text: z.string().trim().min(1).max(300),
    isCorrect: z.boolean(),
  })
  .strict()

const questionRecordSchema = z
  .object({
    id: uuid,
    goalId: uuid,
    prompt: z.string().trim().min(1).max(1_000),
    imageBlobKey: uuid.optional(),
    audioBlobKey: uuid.optional(),
    answers: z.array(questionAnswerRecordSchema).min(2).max(10),
    reviewState: z
      .object({
        timesSeen: z.number().int().min(0).max(1_000_000),
        timesCorrect: z.number().int().min(0).max(1_000_000),
        timesIncorrect: z.number().int().min(0).max(1_000_000),
        lastSeenAt: timestamp.nullable(),
        weight: z.number().finite().positive().max(1_000_000),
      })
      .strict(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (!data.answers.some((answer) => answer.isCorrect)) {
      ctx.addIssue({ code: 'custom', path: ['answers'], message: 'correctAnswerRequired' })
    }
  })

const examResponseSchema = z
  .object({
    questionId: uuid,
    chosenAnswerIds: z.array(uuid).max(10),
    isCorrect: z.boolean(),
    answeredAt: timestamp,
  })
  .strict()

const examAttemptRecordSchema = z
  .object({
    id: uuid,
    goalId: uuid,
    kind: examKind,
    title: z.string().trim().min(1).max(80),
    startedAt: timestamp,
    pausedAt: timestamp.nullable(),
    endedAt: timestamp.nullable(),
    totalPausedMs: nonNegativeInteger,
    status: examStatus,
    timeLimitMs: z
      .number()
      .int()
      .positive()
      .max(7 * 24 * 60 * 60 * 1_000)
      .nullable(),
    score: z.number().finite().min(0).max(1_000_000).nullable(),
    maxScore: z.number().finite().min(0).max(1_000_000).nullable(),
    notes: z.string().max(10_000),
    pdfMaterialId: uuid.optional(),
    pdfNoteId: uuid.optional(),
    questionIds: z.array(uuid).max(SNAPSHOT_LIMITS.questionsPerExam).optional(),
    responses: z.array(examResponseSchema).max(SNAPSHOT_LIMITS.responsesPerExam).optional(),
    createdAt: timestamp,
    updatedAt: timestamp,
  })
  .strict()

export const CURRENT_EXPORT_VERSION = 7

const payloadV1Schema = z
  .object({
    version: z.literal(1),
    exportedAt: z.number(),
    goals: z.array(goalRecordSchema).max(SNAPSHOT_LIMITS.goals),
    sessions: z.array(sessionV1Schema).max(SNAPSHOT_LIMITS.sessions),
  })
  .strict()

const payloadV2Schema = z
  .object({
    version: z.literal(2),
    exportedAt: z.number(),
    goals: z.array(goalRecordSchema).max(SNAPSHOT_LIMITS.goals),
    sessions: z.array(sessionV1Schema).max(SNAPSHOT_LIMITS.sessions),
    materials: z.array(materialRecordSchema).max(SNAPSHOT_LIMITS.materials),
    materialGoalLinks: z.array(materialGoalLinkRecordSchema).max(SNAPSHOT_LIMITS.materialGoalLinks),
  })
  .strict()

const payloadV3Schema = z
  .object({
    version: z.literal(3),
    exportedAt: z.number(),
    goals: z.array(goalRecordSchema).max(SNAPSHOT_LIMITS.goals),
    sessions: z.array(sessionV3Schema).max(SNAPSHOT_LIMITS.sessions),
    materials: z.array(materialRecordSchema).max(SNAPSHOT_LIMITS.materials),
    materialGoalLinks: z.array(materialGoalLinkRecordSchema).max(SNAPSHOT_LIMITS.materialGoalLinks),
    materialProgress: z.array(materialProgressRecordSchema).max(SNAPSHOT_LIMITS.materialProgress),
  })
  .strict()

const payloadV4Schema = z
  .object({
    version: z.literal(4),
    exportedAt: z.number(),
    goals: z.array(goalRecordSchema).max(SNAPSHOT_LIMITS.goals),
    sessions: z.array(sessionRecordSchema).max(SNAPSHOT_LIMITS.sessions),
    materials: z.array(materialRecordSchema).max(SNAPSHOT_LIMITS.materials),
    materialGoalLinks: z.array(materialGoalLinkRecordSchema).max(SNAPSHOT_LIMITS.materialGoalLinks),
    materialProgress: z.array(materialProgressRecordSchema).max(SNAPSHOT_LIMITS.materialProgress),
  })
  .strict()

const payloadV5Schema = z
  .object({
    version: z.literal(5),
    exportedAt: z.number(),
    goals: z.array(goalRecordSchema).max(SNAPSHOT_LIMITS.goals),
    sessions: z.array(sessionRecordSchema).max(SNAPSHOT_LIMITS.sessions),
    materials: z.array(materialRecordSchema).max(SNAPSHOT_LIMITS.materials),
    materialGoalLinks: z.array(materialGoalLinkRecordSchema).max(SNAPSHOT_LIMITS.materialGoalLinks),
    materialProgress: z.array(materialProgressRecordSchema).max(SNAPSHOT_LIMITS.materialProgress),
    notes: z.array(noteV5RecordSchema).max(SNAPSHOT_LIMITS.notes),
  })
  .strict()

const payloadV6Schema = z
  .object({
    version: z.literal(6),
    exportedAt: z.number(),
    goals: z.array(goalRecordSchema).max(SNAPSHOT_LIMITS.goals),
    sessions: z.array(sessionRecordSchema).max(SNAPSHOT_LIMITS.sessions),
    materials: z.array(materialRecordSchema).max(SNAPSHOT_LIMITS.materials),
    materialGoalLinks: z.array(materialGoalLinkRecordSchema).max(SNAPSHOT_LIMITS.materialGoalLinks),
    materialProgress: z.array(materialProgressRecordSchema).max(SNAPSHOT_LIMITS.materialProgress),
    notes: z.array(noteV5RecordSchema).max(SNAPSHOT_LIMITS.notes),
    questions: z.array(questionRecordSchema).max(SNAPSHOT_LIMITS.questions),
    examAttempts: z.array(examAttemptRecordSchema).max(SNAPSHOT_LIMITS.examAttempts),
  })
  .strict()

const payloadV7Schema = z
  .object({
    version: z.literal(7),
    exportedAt: z.number(),
    goals: z.array(goalRecordSchema).max(SNAPSHOT_LIMITS.goals),
    sessions: z.array(sessionRecordSchema).max(SNAPSHOT_LIMITS.sessions),
    materials: z.array(materialRecordSchema).max(SNAPSHOT_LIMITS.materials),
    materialGoalLinks: z.array(materialGoalLinkRecordSchema).max(SNAPSHOT_LIMITS.materialGoalLinks),
    materialProgress: z.array(materialProgressRecordSchema).max(SNAPSHOT_LIMITS.materialProgress),
    notes: z.array(noteRecordSchema).max(SNAPSHOT_LIMITS.notes),
    questions: z.array(questionRecordSchema).max(SNAPSHOT_LIMITS.questions),
    examAttempts: z.array(examAttemptRecordSchema).max(SNAPSHOT_LIMITS.examAttempts),
  })
  .strict()

export const exportPayloadSchema = z.union([
  payloadV1Schema,
  payloadV2Schema,
  payloadV3Schema,
  payloadV4Schema,
  payloadV5Schema,
  payloadV6Schema,
  payloadV7Schema,
])

export type ExportPayload = z.infer<typeof payloadV7Schema>

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

function assertSafeObjectGraph(raw: unknown): void {
  const visited = new WeakSet<object>()
  let nodes = 0

  const visit = (value: unknown, depth: number) => {
    if (!value || typeof value !== 'object') return
    if (depth > 64) throw new Error('Import nesting is too deep')
    if (visited.has(value)) return
    visited.add(value)
    nodes += 1
    if (nodes > 500_000) throw new Error('Import contains too many values')

    for (const key of Object.keys(value)) {
      if (key === '__proto__' || key === 'prototype' || key === 'constructor') {
        throw new Error('Import contains a forbidden object key')
      }
      visit((value as Record<string, unknown>)[key], depth + 1)
    }
  }

  visit(raw, 0)
}

function assertUnique(values: string[], label: string): void {
  if (new Set(values).size !== values.length) {
    throw new Error(`Import contains duplicate ${label}`)
  }
}

function assertReferences(payload: ExportPayload): void {
  const goalIds = new Set(payload.goals.map((item) => item.id))
  const sessionIds = new Set(payload.sessions.map((item) => item.id))
  const materialIds = new Set(payload.materials.map((item) => item.id))
  const materialById = new Map(payload.materials.map((item) => [item.id, item]))
  const noteIds = new Set(payload.notes.map((item) => item.id))
  const questionById = new Map(payload.questions.map((item) => [item.id, item]))

  assertUnique(
    payload.goals.map((item) => item.id),
    'goal id',
  )
  assertUnique(
    payload.sessions.map((item) => item.id),
    'session id',
  )
  assertUnique(
    payload.materials.map((item) => item.id),
    'material id',
  )
  assertUnique(
    payload.materialGoalLinks.map((item) => item.id),
    'material link id',
  )
  assertUnique(
    payload.materialProgress.map((item) => item.id),
    'progress id',
  )
  assertUnique(
    payload.notes.map((item) => item.id),
    'note id',
  )
  assertUnique(
    payload.questions.map((item) => item.id),
    'question id',
  )
  assertUnique(
    payload.examAttempts.map((item) => item.id),
    'exam id',
  )
  assertUnique(
    payload.materialGoalLinks.map((item) => `${item.materialId}:${item.goalId}`),
    'material-to-goal relation',
  )

  for (const goal of payload.goals) {
    assertUnique(goal.scheduledDays, `scheduled day in goal ${goal.id}`)
  }
  for (const session of payload.sessions) {
    if (session.goalId && !goalIds.has(session.goalId)) {
      throw new Error('Session references an unknown goal')
    }
    assertUnique(session.materialIds, `material id in session ${session.id}`)
    if (session.materialIds.some((id) => !materialIds.has(id))) {
      throw new Error('Session references an unknown material')
    }
  }
  for (const link of payload.materialGoalLinks) {
    if (!materialIds.has(link.materialId) || !goalIds.has(link.goalId)) {
      throw new Error('Material link contains an unknown reference')
    }
  }
  for (const progress of payload.materialProgress) {
    const material = materialById.get(progress.materialId)
    if (
      !material ||
      material.kind !== progress.kind ||
      (progress.goalId !== null && !goalIds.has(progress.goalId)) ||
      (progress.sessionId !== null && !sessionIds.has(progress.sessionId))
    ) {
      throw new Error('Material progress contains an unknown or inconsistent reference')
    }
    if (progress.videoRanges?.some(([start, end]) => end < start)) {
      throw new Error('Material progress contains an invalid video range')
    }
  }
  for (const note of payload.notes) {
    assertUnique(note.goalIds, `goal id in note ${note.id}`)
    if (
      note.goalIds.some((id) => !goalIds.has(id)) ||
      (note.sourceSessionId !== null && !sessionIds.has(note.sourceSessionId))
    ) {
      throw new Error('Note contains an unknown reference')
    }
  }
  for (const question of payload.questions) {
    if (!goalIds.has(question.goalId)) throw new Error('Question references an unknown goal')
    assertUnique(
      question.answers.map((answer) => answer.id),
      `answer id in question ${question.id}`,
    )
  }
  for (const attempt of payload.examAttempts) {
    if (!goalIds.has(attempt.goalId)) throw new Error('Exam references an unknown goal')
    if (
      (attempt.score !== null && attempt.maxScore !== null && attempt.score > attempt.maxScore) ||
      (attempt.kind === 'pdf' && !attempt.pdfMaterialId && !attempt.pdfNoteId)
    ) {
      throw new Error('Exam contains an invalid score or source')
    }
    if (
      (attempt.pdfMaterialId && !materialIds.has(attempt.pdfMaterialId)) ||
      (attempt.pdfNoteId && !noteIds.has(attempt.pdfNoteId))
    ) {
      throw new Error('Exam references an unknown PDF source')
    }
    const questionIds = attempt.questionIds ?? []
    assertUnique(questionIds, `question id in exam ${attempt.id}`)
    if (questionIds.some((id) => !questionById.has(id))) {
      throw new Error('Exam references an unknown question')
    }
    for (const response of attempt.responses ?? []) {
      const question = questionById.get(response.questionId)
      if (!question || !questionIds.includes(response.questionId)) {
        throw new Error('Exam response references an unknown question')
      }
      const answerIds = new Set(question.answers.map((answer) => answer.id))
      if (response.chosenAnswerIds.some((id) => !answerIds.has(id))) {
        throw new Error('Exam response references an unknown answer')
      }
    }
  }
}

function validateCurrentPayload(raw: unknown): ExportPayload {
  assertSafeObjectGraph(raw)
  const payload = payloadV7Schema.parse(raw)
  assertReferences(payload)
  assertSnapshotSize(payload)
  return payload
}

export async function buildExportPayload(database: MigaDatabase = db): Promise<ExportPayload> {
  const [
    goals,
    sessions,
    materials,
    materialGoalLinks,
    materialProgress,
    notes,
    questions,
    examAttempts,
  ] = await database.transaction(
    'r',
    [
      database.goals,
      database.sessions,
      database.materials,
      database.materialGoalLinks,
      database.materialProgress,
      database.notes,
      database.questions,
      database.examAttempts,
    ],
    () =>
      Promise.all([
        database.goals.toArray(),
        database.sessions.toArray(),
        database.materials.toArray(),
        database.materialGoalLinks.toArray(),
        database.materialProgress.toArray(),
        database.notes.toArray(),
        database.questions.toArray(),
        database.examAttempts.toArray(),
      ]),
  )
  // Note blobs, material blobs and question blobs (voice recordings,
  // uploaded documents, images, audio prompts) are intentionally NOT
  // included in the backup: they can be very heavy and the JSON is meant
  // to be lightweight and portable. Restoring on another device loses the
  // raw files but keeps every entity's metadata, text and structure.
  return validateCurrentPayload({
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
  })
}

function migrateV5NotesToV7(
  notes: z.infer<typeof noteV5RecordSchema>[],
): z.infer<typeof noteRecordSchema>[] {
  return notes.map((n) => {
    const { goalId, ...rest } = n
    return {
      ...rest,
      goalIds: [goalId],
      source: inferNoteSource(rest.sourceSessionId, rest.title),
    }
  })
}

export function parseImportPayload(raw: unknown): ExportPayload {
  assertSafeObjectGraph(raw)
  const parsed = exportPayloadSchema.parse(raw)
  let migrated: ExportPayload
  if (parsed.version === 1) {
    migrated = {
      version: 7,
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
  } else if (parsed.version === 2) {
    migrated = {
      version: 7,
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
  } else if (parsed.version === 3) {
    migrated = {
      version: 7,
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
  } else if (parsed.version === 4) {
    migrated = {
      ...parsed,
      version: 7,
      notes: [],
      questions: [],
      examAttempts: [],
    }
  } else if (parsed.version === 5) {
    migrated = {
      ...parsed,
      version: 7,
      notes: migrateV5NotesToV7(parsed.notes),
      questions: [],
      examAttempts: [],
    }
  } else if (parsed.version === 6) {
    migrated = {
      ...parsed,
      version: 7,
      notes: migrateV5NotesToV7(parsed.notes),
    }
  } else {
    migrated = parsed
  }
  return validateCurrentPayload(migrated)
}

async function writeStructuredData(
  payload: ExportPayload,
  replaceExisting: boolean,
  normalizeActiveSessions: boolean,
  database: MigaDatabase,
  syncMetadata?: WorkspaceSyncMetadata,
): Promise<ImportResult> {
  payload = validateCurrentPayload(payload)
  const now = Date.now()
  let normalizedActiveSessions = 0

  const sessions: Session[] = payload.sessions.map((s) => {
    const normalized: Session = {
      ...s,
      materialIds: Array.isArray(s.materialIds) ? s.materialIds : [],
    }
    if (
      normalizeActiveSessions &&
      (normalized.status === 'running' || normalized.status === 'paused')
    ) {
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

  const transactionTables = [
    database.goals,
    database.sessions,
    database.materials,
    database.materialGoalLinks,
    database.materialProgress,
    database.notes,
    database.questions,
    database.examAttempts,
    ...(syncMetadata ? [database.syncMetadata] : []),
  ]

  await database.transaction('rw', transactionTables, async () => {
    if (replaceExisting) {
      await Promise.all([
        database.goals.clear(),
        database.sessions.clear(),
        database.materials.clear(),
        database.materialGoalLinks.clear(),
        database.materialProgress.clear(),
        database.notes.clear(),
        database.questions.clear(),
        database.examAttempts.clear(),
      ])
    }
    await database.goals.bulkPut(goals)
    await database.sessions.bulkPut(sessions)
    await database.materials.bulkPut(materials)
    await database.materialGoalLinks.bulkPut(materialGoalLinks)
    await database.materialProgress.bulkPut(materialProgress)
    await database.notes.bulkPut(notes)
    await database.questions.bulkPut(questions)
    await database.examAttempts.bulkPut(examAttempts)
    if (syncMetadata) await database.syncMetadata.put(syncMetadata)
  })

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

export function importAllData(
  payload: ExportPayload,
  database: MigaDatabase = db,
): Promise<ImportResult> {
  return writeStructuredData(payload, false, true, database)
}

/**
 * Replaces the server-backed structured snapshot atomically while preserving
 * binary stores. Blobs are device-local and intentionally absent from the
 * server snapshot, so deleting the whole scoped database on each pull would
 * destroy valid PDF/video/audio/image attachments.
 */
export function replaceStructuredData(
  payload: ExportPayload,
  database: MigaDatabase = db,
  syncMetadata?: WorkspaceSyncMetadata,
): Promise<ImportResult> {
  return writeStructuredData(payload, true, false, database, syncMetadata)
}

export async function clearAllData(database: MigaDatabase = db): Promise<void> {
  await database.transaction(
    'rw',
    [
      database.goals,
      database.sessions,
      database.materials,
      database.materialGoalLinks,
      database.materialProgress,
      database.materialBlobs,
      database.notes,
      database.noteBlobs,
      database.questions,
      database.questionBlobs,
      database.examAttempts,
    ],
    async () => {
      await database.goals.clear()
      await database.sessions.clear()
      await database.materials.clear()
      await database.materialGoalLinks.clear()
      await database.materialProgress.clear()
      await database.materialBlobs.clear()
      await database.notes.clear()
      await database.noteBlobs.clear()
      await database.questions.clear()
      await database.questionBlobs.clear()
      await database.examAttempts.clear()
    },
  )
}
