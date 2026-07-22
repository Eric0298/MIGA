import { expect, test } from '@playwright/test'
import { resetApp, seedGoal } from './helpers/seed'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('opens the session detail from the sessions list', async ({ page }) => {
  const goal = await seedGoal(page, 'Meta detalle')

  // Seed a completed session tied to the goal and a note taken during it.
  await page.evaluate(
    async ({ goalId }: { goalId: string }) => {
      const now = Date.now()
      const sessionId = crypto.randomUUID()
      const startedAt = now - 30 * 60_000
      const endedAt = now - 10 * 60_000
      const session = {
        id: sessionId,
        goalId,
        materialIds: [] as string[],
        startedAt,
        pausedAt: null,
        endedAt,
        totalPausedMs: 5 * 60_000,
        status: 'completed' as const,
        createdAt: startedAt,
        updatedAt: endedAt,
      }
      const note = {
        id: crypto.randomUUID(),
        goalIds: [goalId],
        kind: 'text' as const,
        title: 'Idea rápida',
        text: 'Repasar mañana',
        metadata: {},
        sourceSessionId: sessionId,
        source: 'session' as const,
        createdAt: now,
        updatedAt: now,
      }
      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('miga')
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction(['sessions', 'notes'], 'readwrite')
          tx.objectStore('sessions').put(session)
          tx.objectStore('notes').put(note)
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
    { goalId: goal.id },
  )

  await page.goto('/app/sesiones')

  await page.getByRole('link', { name: 'Ver detalle de la sesión' }).click()

  await expect(page).toHaveURL(/\/app\/sesiones\/[^/]+$/)
  await expect(page.getByRole('heading', { name: goal.name })).toBeVisible()
  await expect(page.getByText('Duración real')).toBeVisible()
  // Paused = 5 minutes → "00:05:00".
  await expect(page.getByText('00:05:00')).toBeVisible()
  // Notes section shows the session note.
  await expect(page.getByText('Apuntes de la sesión')).toBeVisible()
  await expect(page.getByText('Idea rápida')).toBeVisible()
})
