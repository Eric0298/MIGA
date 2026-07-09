import { db } from './miga-db'
import { goalInputSchema, type Goal, type GoalInput } from './schema'
import { deleteNotesByGoal } from './notes.repository'

export async function createGoal(input: GoalInput): Promise<Goal> {
  const parsed = goalInputSchema.parse(input)
  const now = Date.now()
  const goal: Goal = {
    id: crypto.randomUUID(),
    ...parsed,
    createdAt: now,
    updatedAt: now,
  }
  await db.goals.add(goal)
  return goal
}

export function listGoals(): Promise<Goal[]> {
  return db.goals.orderBy('createdAt').reverse().toArray()
}

export async function deleteGoal(id: string): Promise<void> {
  await deleteNotesByGoal(id)
  await db.transaction('rw', db.goals, db.materialGoalLinks, async () => {
    await db.materialGoalLinks.where('goalId').equals(id).delete()
    await db.goals.delete(id)
  })
}
