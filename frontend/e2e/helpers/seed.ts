import type { Page } from '@playwright/test'
import { createHash } from 'node:crypto'

/**
 * Seeds live in a shared helper so every smoke test starts from a known,
 * minimal state: locale forced to Spanish (labels in the app are Spanish),
 * IndexedDB wiped, and only the fixture rows needed by each flow inserted.
 */

const DEMO_WORKSPACE_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
const SCOPE_KEY = createHash('sha256')
  .update(DEMO_WORKSPACE_ID)
  .digest('hex')
  .slice(0, 32)
export const DEXIE_DB_NAME = `miga-scoped-${SCOPE_KEY}`
const LANG_KEY = 'miga.language'
const REQUIRED_STORES = [
  'goals',
  'sessions',
  'materials',
  'materialGoalLinks',
  'materialBlobs',
  'notes',
  'questions',
  'examAttempts',
  'syncMetadata',
]

/**
 * Boots the SPA, wipes IndexedDB, and reloads so Dexie recreates its schema
 * from scratch. After this the app is on `/app` with an empty database and
 * the Spanish locale forced.
 */
export async function resetApp(page: Page): Promise<void> {
  let revision = 0
  let snapshotData: unknown = {
    version: 7,
    exportedAt: Date.now(),
    goals: [],
    sessions: [],
    materials: [],
    materialGoalLinks: [],
    materialProgress: [],
    notes: [],
    questions: [],
    examAttempts: [],
  }
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/auth/session' && request.method() === 'GET') {
      await route.fulfill({
        json: {
          authenticated: true,
          accountType: 'demo',
          workspaceId: DEMO_WORKSPACE_ID,
          userId: null,
          email: null,
          expiresAtUtc: '2099-07-24T10:00:00.000Z',
          emailConfirmed: true,
        },
      })
      return
    }
    if (url.pathname === '/api/auth/csrf' && request.method() === 'GET') {
      await route.fulfill({ json: { requestToken: 'e2e-csrf-request-token' } })
      return
    }
    if (url.pathname === '/api/data/snapshot' && request.method() === 'GET') {
      await route.fulfill({
        json: {
          revision,
          updatedAtUtc: '2026-07-23T10:00:00.000Z',
          data: snapshotData,
        },
      })
      return
    }
    if (url.pathname === '/api/data/snapshot' && request.method() === 'PUT') {
      const body = request.postDataJSON() as { revision: number; data: unknown }
      if (body.revision !== revision) {
        await route.fulfill({
          status: 409,
          contentType: 'application/problem+json',
          body: JSON.stringify({ status: 409, code: 'revision_conflict' }),
        })
        return
      }
      revision += 1
      snapshotData = body.data
      await route.fulfill({
        json: {
          revision,
          updatedAtUtc: new Date().toISOString(),
          data: snapshotData,
        },
      })
      return
    }
    await route.fulfill({ status: 204, body: '' })
  })
  await page.addInitScript(
    ({ langKey, lang }: { langKey: string; lang: string }) => {
      try {
        window.localStorage.setItem(langKey, lang)
      } catch {
        // ignore
      }
    },
    { langKey: LANG_KEY, lang: 'es' },
  )
  // Use a same-origin static document without the SPA so no Dexie connection
  // can block deletion of a database left by a previous test.
  await page.goto('/brand/miga-palette.css')
  await page.evaluate(async (dbName: string) => {
    await new Promise<void>((resolve) => {
      const req = indexedDB.deleteDatabase(dbName)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    })
  }, DEXIE_DB_NAME)
  await page.goto('/app')
  await page.waitForFunction(
    ({ dbName, stores }: { dbName: string; stores: string[] }) => {
      return new Promise<boolean>((resolve) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => {
          const names = req.result.objectStoreNames
          const ok = stores.every((s) => names.contains(s))
          req.result.close()
          resolve(ok)
        }
        req.onerror = () => resolve(false)
        req.onblocked = () => resolve(false)
      })
    },
    { dbName: DEXIE_DB_NAME, stores: REQUIRED_STORES },
  )
  // The schema can exist before authenticated bootstrap has finished its
  // initial snapshot transaction. Wait for the mounted sync provider so seed
  // writes cannot race with that transaction and be cleared.
  await page.getByText('Guardado', { exact: true }).first().waitFor({ state: 'visible' })
}

export type SeededGoal = { id: string; name: string }

/**
 * Navigates without reloading the document. Direct fixture writes are local
 * and intentionally bypass the API mock, so a full reload would bootstrap the
 * last server snapshot and replace them before the target screen can read them.
 */
export async function navigateInApp(page: Page, path: string): Promise<void> {
  await page.evaluate((nextPath: string) => {
    window.history.pushState(null, '', nextPath)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, path)
  await page.waitForURL(path)
}

export async function seedGoal(page: Page, name = 'Meta E2E'): Promise<SeededGoal> {
  const id = await page.evaluate(
    async ({ dbName, goalName }: { dbName: string; goalName: string }) => {
      const goalId = crypto.randomUUID()
      const now = Date.now()
      const today = new Date()
      const toIso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const scheduledDays = [toIso(today)]

      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction('goals', 'readwrite')
          tx.objectStore('goals').put({
            id: goalId,
            name: goalName,
            targetMinutes: 600,
            scheduledDays,
            createdAt: now,
            updatedAt: now,
          })
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
      return goalId
    },
    { dbName: DEXIE_DB_NAME, goalName: name },
  )
  return { id, name }
}

export async function seedPdfMaterial(
  page: Page,
  goalId: string,
  title = 'PDF de prueba',
): Promise<{ materialId: string; blobKey: string }> {
  return page.evaluate(
    async ({
      dbName,
      goalId: gId,
      materialTitle,
    }: {
      dbName: string
      goalId: string
      materialTitle: string
    }) => {
      const materialId = crypto.randomUUID()
      const blobKey = crypto.randomUUID()
      const linkId = crypto.randomUUID()
      const now = Date.now()
      // Minimal valid-looking PDF (viewer won't render but the flow only
      // needs the blob record to exist so the source picker lists it).
      const pdfBytes = new TextEncoder().encode('%PDF-1.4\n%%EOF\n')
      const blob = new Blob([pdfBytes], { type: 'application/pdf' })

      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction(
            ['materials', 'materialBlobs', 'materialGoalLinks'],
            'readwrite',
          )
          tx.objectStore('materials').put({
            id: materialId,
            kind: 'pdf',
            title: materialTitle,
            fileBlobKey: blobKey,
            metadata: {
              mimeType: 'application/pdf',
              fileSizeBytes: pdfBytes.byteLength,
            },
            createdAt: now,
            updatedAt: now,
          })
          tx.objectStore('materialBlobs').put({
            id: blobKey,
            materialId,
            mimeType: 'application/pdf',
            size: pdfBytes.byteLength,
            blob,
            createdAt: now,
          })
          tx.objectStore('materialGoalLinks').put({
            id: linkId,
            materialId,
            goalId: gId,
            createdAt: now,
          })
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
      return { materialId, blobKey }
    },
    { dbName: DEXIE_DB_NAME, goalId, materialTitle: title },
  )
}

export async function seedQuestions(page: Page, goalId: string): Promise<string[]> {
  return page.evaluate(
    async ({ dbName, goalId: gId }: { dbName: string; goalId: string }) => {
      const now = Date.now()
      const emptyReviewState = {
        timesSeen: 0,
        timesCorrect: 0,
        timesIncorrect: 0,
        lastSeenAt: null,
        weight: 1,
      }
      const build = (index: number) => {
        const correctId = crypto.randomUUID()
        const wrongId = crypto.randomUUID()
        // Stagger createdAt by index so `sortBy('createdAt')` is deterministic
        // and "original order" in the exam create page respects (1, 2, ...).
        const at = now + index
        return {
          id: crypto.randomUUID(),
          goalId: gId,
          prompt: `Pregunta E2E ${index}`,
          answers: [
            { id: correctId, text: `Correcta ${index}`, isCorrect: true },
            { id: wrongId, text: `Incorrecta ${index}`, isCorrect: false },
          ],
          reviewState: emptyReviewState,
          createdAt: at,
          updatedAt: at,
        }
      }
      const rows = [build(1), build(2)]

      await new Promise<void>((resolve, reject) => {
        const req = indexedDB.open(dbName)
        req.onsuccess = () => {
          const idb = req.result
          const tx = idb.transaction('questions', 'readwrite')
          const store = tx.objectStore('questions')
          for (const row of rows) store.put(row)
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
      return rows.map((r) => r.id)
    },
    { dbName: DEXIE_DB_NAME, goalId },
  )
}
