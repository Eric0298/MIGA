import { afterEach, describe, expect, it } from 'vitest'
import { db } from './miga-db'
import { createGoal, deleteGoal, listGoals } from './goals.repository'

afterEach(async () => {
  await db.goals.clear()
})

describe('goals repository', () => {
  it('creates and lists a goal with total target and scheduled days', async () => {
    const created = await createGoal({
      name: 'Preparar oposición',
      targetMinutes: 900,
      scheduledDays: ['2026-07-10', '2026-07-11', '2026-07-12'],
    })
    expect(created.id).toBeTypeOf('string')
    expect(created.createdAt).toBeGreaterThan(0)

    const goals = await listGoals()
    expect(goals).toHaveLength(1)
    expect(goals[0].name).toBe('Preparar oposición')
    expect(goals[0].targetMinutes).toBe(900)
    expect(goals[0].scheduledDays).toEqual(['2026-07-10', '2026-07-11', '2026-07-12'])
  })

  it('lists newest first', async () => {
    await createGoal({
      name: 'Primera',
      targetMinutes: 60,
      scheduledDays: ['2026-07-01'],
    })
    await new Promise((r) => setTimeout(r, 2))
    await createGoal({
      name: 'Segunda',
      targetMinutes: 120,
      scheduledDays: ['2026-07-02'],
    })

    const goals = await listGoals()
    expect(goals.map((g) => g.name)).toEqual(['Segunda', 'Primera'])
  })

  it('deletes a goal', async () => {
    const created = await createGoal({
      name: 'Borrame',
      targetMinutes: 30,
      scheduledDays: ['2026-07-10'],
    })
    await deleteGoal(created.id)
    const goals = await listGoals()
    expect(goals).toEqual([])
  })

  it('rejects an empty scheduledDays list', async () => {
    await expect(
      createGoal({ name: 'Sin días', targetMinutes: 60, scheduledDays: [] }),
    ).rejects.toBeDefined()
  })

  it('rejects an invalid day format', async () => {
    await expect(
      createGoal({
        name: 'Fecha rara',
        targetMinutes: 60,
        scheduledDays: ['10-07-2026'],
      }),
    ).rejects.toBeDefined()
  })

  it('rejects a total below the minimum', async () => {
    await expect(
      createGoal({
        name: 'Muy poco',
        targetMinutes: 5,
        scheduledDays: ['2026-07-10'],
      }),
    ).rejects.toBeDefined()
  })
})
