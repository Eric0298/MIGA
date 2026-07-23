import { expect, test } from '@playwright/test'
import { DEXIE_DB_NAME, navigateInApp, resetApp, seedGoal } from './helpers/seed'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('filters the global notes hub by goal and origin', async ({ page }) => {
  const goalA = await seedGoal(page, 'Meta A')
  const goalB = await seedGoal(page, 'Meta B')

  // Seed one manual note per goal directly into Dexie so we can assert filter
  // behavior without going through the create UI (already covered elsewhere).
  await page.evaluate(
    async ({ ids, dbName }: { ids: { a: string; b: string }; dbName: string }) => {
      const now = Date.now()
      const makeNote = (goalId: string, index: number, title: string) => ({
        id: crypto.randomUUID(),
        goalIds: [goalId],
        kind: 'text' as const,
        title,
        text: 'Contenido',
        metadata: {},
        sourceSessionId: null,
        source: 'manual' as const,
        createdAt: now + index,
        updatedAt: now + index,
      })
      const rows = [makeNote(ids.a, 1, 'Nota A'), makeNote(ids.b, 2, 'Nota B')]
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction('notes', 'readwrite')
          for (const row of rows) tx.objectStore('notes').put(row)
          tx.oncomplete = () => {
            idb.close()
            resolve()
          }
          tx.onerror = () => {
            idb.close()
            reject(tx.error)
          }
        }
        req.onerror = () => reject(req.error)
      })
    },
    { ids: { a: goalA.id, b: goalB.id }, dbName: DEXIE_DB_NAME },
  )

  await navigateInApp(page, '/app/notas')

  // No filters → both notes visible.
  await expect(page.getByText('Nota A')).toBeVisible()
  await expect(page.getByText('Nota B')).toBeVisible()

  const filters = page.getByRole('region', { name: 'Filtros' })

  // Filter by Meta A → only Nota A remains.
  await filters.getByRole('button', { name: goalA.name }).click()
  await expect(page.getByText('Nota A')).toBeVisible()
  await expect(page.getByText('Nota B')).toHaveCount(0)

  await page.getByRole('button', { name: 'Quitar filtros' }).click()
  await expect(page.getByText('Nota B')).toBeVisible()
})
