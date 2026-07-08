import Dexie, { type Table } from 'dexie'
import type { Goal } from './schema'

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
  }
}

export const db = new MigaDatabase()
