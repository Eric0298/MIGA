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

export type WorkspaceSyncMetadata = {
  id: 'workspace'
  revision: number
  updatedAtUtc: string
  dirty: boolean
  contentHash?: string
}

type LegacyDayTarget = { day: string; targetMinutes: number }
type LegacyGoal = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  days?: LegacyDayTarget[]
}

export const LEGACY_DATABASE_NAME = 'miga'
const SCOPED_DATABASE_PREFIX = 'miga-scoped-'
const SCOPED_DATABASE_NAME_PATTERN = /^miga-scoped-[a-f0-9]{24,64}$/

export class MigaDatabase extends Dexie {
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
  syncMetadata!: Table<WorkspaceSyncMetadata, 'workspace'>

  constructor(databaseName: string) {
    super(databaseName)

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

    // v11 — durable optimistic-sync state. This store is local-only and is
    // never included in the server snapshot.
    this.version(11).stores({
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
      syncMetadata: '&id',
    })
  }
}

let activeScopeKey: string | null = null

/**
 * ESM imports are live bindings, so repositories that import `db` always see
 * the currently activated instance. The legacy database is instantiated at
 * startup but Dexie does not open it until a query is executed.
 */
export let db = new MigaDatabase(LEGACY_DATABASE_NAME)

function scopedDatabaseName(scopeKey: string): string {
  if (!/^[a-f0-9]{24,64}$/.test(scopeKey)) {
    throw new Error('Invalid database scope')
  }
  return `${SCOPED_DATABASE_PREFIX}${scopeKey}`
}

export function getActiveDatabaseScope(): string | null {
  return activeScopeKey
}

export function getActiveDatabaseName(): string {
  return db.name
}

export function getActiveDatabase(): MigaDatabase {
  return db
}

export function isActiveDatabase(database: MigaDatabase, scopeKey: string): boolean {
  return (
    db === database && activeScopeKey === scopeKey && database.name === scopedDatabaseName(scopeKey)
  )
}

export function activateScopedDatabase(scopeKey: string): MigaDatabase {
  const nextName = scopedDatabaseName(scopeKey)
  if (activeScopeKey === scopeKey && db.name === nextName) return db

  db.close()
  activeScopeKey = scopeKey
  db = new MigaDatabase(nextName)
  return db
}

export function activateLegacyDatabase(): MigaDatabase {
  if (activeScopeKey === null && db.name === LEGACY_DATABASE_NAME) return db
  db.close()
  activeScopeKey = null
  db = new MigaDatabase(LEGACY_DATABASE_NAME)
  return db
}

/** Deletes and recreates only the currently authenticated/demo scoped DB. */
export async function resetActiveScopedDatabase(): Promise<MigaDatabase> {
  if (!activeScopeKey || db.name === LEGACY_DATABASE_NAME) {
    throw new Error('Refusing to reset the legacy database')
  }
  const scopeKey = activeScopeKey
  const databaseName = db.name
  db.close()
  await Dexie.delete(databaseName)
  db = new MigaDatabase(scopedDatabaseName(scopeKey))
  return db
}

/**
 * Closes the active remote database and returns to a dormant legacy instance.
 * The legacy database is deliberately not opened here.
 */
export async function deactivateScopedDatabase({
  deleteLocalData = false,
}: {
  deleteLocalData?: boolean
} = {}): Promise<void> {
  const databaseName = db.name
  const wasScoped = activeScopeKey !== null && databaseName !== LEGACY_DATABASE_NAME
  db.close()
  activeScopeKey = null
  if (deleteLocalData && wasScoped) await Dexie.delete(databaseName)
  db = new MigaDatabase(LEGACY_DATABASE_NAME)
}

/**
 * Explicitly deletes one identity's local database. Passing null targets the
 * legacy local-only workspace. Other scoped databases are never affected.
 */
export async function deleteLocalDatabaseForScope(scopeKey: string | null): Promise<void> {
  const databaseName = scopeKey === null ? LEGACY_DATABASE_NAME : scopedDatabaseName(scopeKey)
  const deletingActive = db.name === databaseName
  if (deletingActive) db.close()
  await Dexie.delete(databaseName)
  if (!deletingActive) return

  if (scopeKey === null) {
    activeScopeKey = null
    db = new MigaDatabase(LEGACY_DATABASE_NAME)
  } else {
    activeScopeKey = scopeKey
    db = new MigaDatabase(databaseName)
  }
}

/**
 * Purges every database created for an authenticated/demo identity while
 * explicitly preserving the pre-auth legacy `miga` database.
 */
export async function deleteAllScopedDatabases(): Promise<void> {
  db.close()
  activeScopeKey = null
  db = new MigaDatabase(LEGACY_DATABASE_NAME)

  const databaseNames = await Dexie.getDatabaseNames()
  const scopedNames = databaseNames.filter((name) => SCOPED_DATABASE_NAME_PATTERN.test(name))
  await Promise.all(scopedNames.map((name) => Dexie.delete(name)))
}
