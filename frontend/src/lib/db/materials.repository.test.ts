import { afterEach, describe, expect, it } from 'vitest'
import { db } from './miga-db'
import {
  attachMaterialToGoal,
  createMaterial,
  deleteLinksOfGoal,
  deleteMaterial,
  detachMaterialFromGoal,
  listAllMaterials,
  listMaterialsByGoal,
} from './materials.repository'

afterEach(async () => {
  await db.materials.clear()
  await db.materialGoalLinks.clear()
})

describe('materials repository', () => {
  it('creates a material and links it to the given goals', async () => {
    const material = await createMaterial(
      {
        kind: 'link',
        title: 'React docs',
        url: 'https://react.dev',
        metadata: {},
      },
      ['goal-1', 'goal-2'],
    )
    expect(material.id).toBeTypeOf('string')
    expect(await db.materialGoalLinks.count()).toBe(2)
    const links = await db.materialGoalLinks.toArray()
    expect(links.map((l) => l.goalId).sort()).toEqual(['goal-1', 'goal-2'])
  })

  it('rejects invalid urls for link kind', async () => {
    await expect(
      createMaterial({ kind: 'link', title: 'Bad', url: 'javascript:alert(1)', metadata: {} }, [
        'goal-1',
      ]),
    ).rejects.toBeDefined()
  })

  it('rejects a link without url', async () => {
    await expect(
      createMaterial({ kind: 'link', title: 'Missing', metadata: {} }, ['goal-1']),
    ).rejects.toBeDefined()
  })

  it('rejects a note without content', async () => {
    await expect(
      createMaterial({ kind: 'note', title: 'Empty', notes: '', metadata: {} }, ['goal-1']),
    ).rejects.toBeDefined()
  })

  it('rejects a title over 80 characters', async () => {
    await expect(
      createMaterial(
        {
          kind: 'note',
          title: 'x'.repeat(81),
          notes: 'ok',
          metadata: {},
        },
        ['goal-1'],
      ),
    ).rejects.toBeDefined()
  })

  it('lists materials by goal ordered by createdAt desc', async () => {
    await createMaterial(
      { kind: 'link', title: 'First', url: 'https://example.org', metadata: {} },
      ['goal-1'],
    )
    await new Promise((r) => setTimeout(r, 2))
    await createMaterial({ kind: 'note', title: 'Second', notes: 'nota', metadata: {} }, ['goal-1'])

    const list = await listMaterialsByGoal('goal-1')
    expect(list.map((m) => m.title)).toEqual(['Second', 'First'])
  })

  it('deleteMaterial removes the material and all its links', async () => {
    const m = await createMaterial(
      { kind: 'link', title: 'Doc', url: 'https://example.org', metadata: {} },
      ['goal-1', 'goal-2'],
    )
    await deleteMaterial(m.id)
    expect(await db.materials.count()).toBe(0)
    expect(await db.materialGoalLinks.count()).toBe(0)
  })

  it('detachMaterialFromGoal only removes the specific link', async () => {
    const m = await createMaterial(
      { kind: 'link', title: 'Doc', url: 'https://example.org', metadata: {} },
      ['goal-1', 'goal-2'],
    )
    await detachMaterialFromGoal(m.id, 'goal-1')
    expect(await db.materials.count()).toBe(1)
    expect(await db.materialGoalLinks.count()).toBe(1)
    const [remaining] = await db.materialGoalLinks.toArray()
    expect(remaining.goalId).toBe('goal-2')
  })

  it('attachMaterialToGoal is idempotent', async () => {
    const m = await createMaterial(
      { kind: 'link', title: 'Doc', url: 'https://example.org', metadata: {} },
      ['goal-1'],
    )
    await attachMaterialToGoal(m.id, 'goal-1')
    await attachMaterialToGoal(m.id, 'goal-1')
    expect(await db.materialGoalLinks.count()).toBe(1)
  })

  it('deleteLinksOfGoal removes links but keeps the material for other goals', async () => {
    const m = await createMaterial(
      { kind: 'link', title: 'Doc', url: 'https://example.org', metadata: {} },
      ['goal-1', 'goal-2'],
    )
    await deleteLinksOfGoal('goal-1')
    expect(await db.materials.count()).toBe(1)
    const remaining = await db.materialGoalLinks.toArray()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].materialId).toBe(m.id)
    expect(remaining[0].goalId).toBe('goal-2')
  })

  it('listAllMaterials returns the whole catalog', async () => {
    await createMaterial({ kind: 'link', title: 'A', url: 'https://a.org', metadata: {} }, [
      'goal-1',
    ])
    await createMaterial({ kind: 'note', title: 'B', notes: 'note', metadata: {} }, ['goal-2'])
    const all = await listAllMaterials()
    expect(all).toHaveLength(2)
  })
})
