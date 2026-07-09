import Dexie, { type Table } from 'dexie'
import type {
  Goal,
  Material,
  MaterialBlob,
  MaterialGoalLink,
  MaterialProgress,
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
          .table<Session>('sessions')
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
  }
}

export const db = new MigaDatabase()
