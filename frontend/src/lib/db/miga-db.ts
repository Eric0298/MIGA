import Dexie, { type Table } from 'dexie'
import type {
  ExamAttempt,
  Goal,
  Material,
  MaterialBlob,
  MaterialGoalLink,
  MaterialProgress,
  Note,
  NoteBlob,
  Question,
  QuestionBlob,
  Session,
} from './schema'

type LegacyDayTarget = { day: string; targetMinutes: number }
type LegacyGoal = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  days?: LegacyDayTarget[]
}

class MigaDatabase extends Dexie {
  goals!: Table<Goal, string>
  sessions!: Table<Session, string>
  materials!: Table<Material, string>
  materialGoalLinks!: Table<MaterialGoalLink, string>
  materialProgress!: Table<MaterialProgress, string>
  materialBlobs!: Table<MaterialBlob, string>
  notes!: Table<Note, string>
  noteBlobs!: Table<NoteBlob, string>
  questions!: Table<Question, string>
  questionBlobs!: Table<QuestionBlob, string>
  examAttempts!: Table<ExamAttempt, string>

  constructor() {
    super('miga')

    this.version(1).stores({
      goals: '&id, createdAt, updatedAt',
    })

    this.version(2)
      .stores({
        goals: '&id, createdAt, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table<LegacyGoal>('goals')
          .toCollection()
          .modify((goal) => {
            if (Array.isArray(goal.days)) {
              const scheduledDays = goal.days.map((d) => d.day)
              const total = goal.days.reduce((sum, d) => sum + (d.targetMinutes ?? 0), 0)
              const migrated = goal as unknown as Goal
              migrated.scheduledDays = scheduledDays
              migrated.targetMinutes = total > 0 ? total : 60
              delete (goal as { days?: LegacyDayTarget[] }).days
            }
          })
      })

    this.version(3).stores({
      goals: '&id, createdAt, updatedAt',
      sessions: '&id, goalId, status, startedAt, endedAt',
    })

    this.version(4).stores({
      goals: '&id, createdAt, updatedAt',
      sessions: '&id, goalId, status, startedAt, endedAt',
      materials: '&id, kind, createdAt, updatedAt',
      materialGoalLinks: '&id, materialId, goalId, [materialId+goalId], createdAt',
    })

    this.version(5)
      .stores({
        goals: '&id, createdAt, updatedAt',
        sessions: '&id, goalId, materialId, status, startedAt, endedAt',
        materials: '&id, kind, createdAt, updatedAt',
        materialGoalLinks: '&id, materialId, goalId, [materialId+goalId], createdAt',
        materialProgress: '&id, materialId, goalId, sessionId, createdAt, endedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table<Session & { materialId?: string | null }>('sessions')
          .toCollection()
          .modify((session) => {
            if (session.materialId === undefined) {
              session.materialId = null
            }
          })
      })

    this.version(6).stores({
      goals: '&id, createdAt, updatedAt',
      sessions: '&id, goalId, materialId, status, startedAt, endedAt',
      materials: '&id, kind, createdAt, updatedAt',
      materialGoalLinks: '&id, materialId, goalId, [materialId+goalId], createdAt',
      materialProgress: '&id, materialId, goalId, sessionId, createdAt, endedAt',
      materialBlobs: '&id, materialId, createdAt',
    })

    // v7 — a Session now holds an array of materials instead of a single one.
    this.version(7)
      .stores({
        goals: '&id, createdAt, updatedAt',
        sessions: '&id, goalId, status, startedAt, endedAt',
        materials: '&id, kind, createdAt, updatedAt',
        materialGoalLinks: '&id, materialId, goalId, [materialId+goalId], createdAt',
        materialProgress: '&id, materialId, goalId, sessionId, createdAt, endedAt',
        materialBlobs: '&id, materialId, createdAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table<Session & { materialId?: string | null }>('sessions')
          .toCollection()
          .modify((session) => {
            if (!Array.isArray(session.materialIds)) {
              session.materialIds = session.materialId ? [session.materialId] : []
            }
            delete session.materialId
          })
      })

    // v8 — user-authored notes ("apuntes") attached to goals.
    this.version(8).stores({
      goals: '&id, createdAt, updatedAt',
      sessions: '&id, goalId, status, startedAt, endedAt',
      materials: '&id, kind, createdAt, updatedAt',
      materialGoalLinks: '&id, materialId, goalId, [materialId+goalId], createdAt',
      materialProgress: '&id, materialId, goalId, sessionId, createdAt, endedAt',
      materialBlobs: '&id, materialId, createdAt',
      notes: '&id, goalId, kind, sourceSessionId, createdAt, updatedAt',
      noteBlobs: '&id, noteId, createdAt',
    })

    // v9 — question bank per goal (for spaced repetition) and exam attempts
    // (both PDF simulacros and self-graded question-based exams).
    this.version(9).stores({
      goals: '&id, createdAt, updatedAt',
      sessions: '&id, goalId, status, startedAt, endedAt',
      materials: '&id, kind, createdAt, updatedAt',
      materialGoalLinks: '&id, materialId, goalId, [materialId+goalId], createdAt',
      materialProgress: '&id, materialId, goalId, sessionId, createdAt, endedAt',
      materialBlobs: '&id, materialId, createdAt',
      notes: '&id, goalId, kind, sourceSessionId, createdAt, updatedAt',
      noteBlobs: '&id, noteId, createdAt',
      questions: '&id, goalId, createdAt, updatedAt',
      questionBlobs: '&id, questionId, createdAt',
      examAttempts: '&id, goalId, kind, status, startedAt, endedAt',
    })

    // v10 — notes can belong to more than one goal (goalIds: string[] indexed
    // multi-entry) and now carry a `source` categorising their origin so the
    // upcoming global notes hub can filter by "manual / session / exam".
    this.version(10)
      .stores({
        goals: '&id, createdAt, updatedAt',
        sessions: '&id, goalId, status, startedAt, endedAt',
        materials: '&id, kind, createdAt, updatedAt',
        materialGoalLinks: '&id, materialId, goalId, [materialId+goalId], createdAt',
        materialProgress: '&id, materialId, goalId, sessionId, createdAt, endedAt',
        materialBlobs: '&id, materialId, createdAt',
        notes: '&id, *goalIds, kind, source, sourceSessionId, createdAt, updatedAt',
        noteBlobs: '&id, noteId, createdAt',
        questions: '&id, goalId, createdAt, updatedAt',
        questionBlobs: '&id, questionId, createdAt',
        examAttempts: '&id, goalId, kind, status, startedAt, endedAt',
      })
      .upgrade(async (tx) => {
        type LegacyNote = {
          goalId?: string
          goalIds?: string[]
          source?: string
          sourceSessionId?: string | null
          title?: string
        }
        await tx
          .table<LegacyNote>('notes')
          .toCollection()
          .modify((note) => {
            if (!Array.isArray(note.goalIds)) {
              note.goalIds = note.goalId ? [note.goalId] : []
            }
            delete note.goalId
            if (!note.source) {
              if (note.sourceSessionId) {
                note.source = 'session'
              } else if (typeof note.title === 'string' && note.title.startsWith('Repaso · ')) {
                note.source = 'exam'
              } else {
                note.source = 'manual'
              }
            }
          })
      })
  }
}

export const db = new MigaDatabase()
