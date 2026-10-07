import { expect, test, type Page } from '@playwright/test'
import type { Session } from '../src/lib/db/schema'
import {
  activeDatabaseName,
  databaseExists,
  installStatefulAuthApi,
  readDatabase,
  seedActiveBlob,
  seedActiveGoal,
} from './helpers/auth-stateful'
import { navigateInApp } from './helpers/seed'

const EMAIL = 'timer-recovery@example.test'
const PASSWORD = 'a-long-unique-password'
const GOAL_NAME = 'Meta de la sesión interrumpida'

type ActiveTimer = Pick<Session, 'id' | 'goalId' | 'startedAt' | 'status'>

async function submitLogin(page: Page): Promise<void> {
  await page.getByLabel('Correo electrónico').fill(EMAIL)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
}

async function readActiveTimer(page: Page, databaseName?: string): Promise<ActiveTimer | null> {
  return page.evaluate(async (name) => {
    // @ts-expect-error Browser-only Vite module loaded inside page.evaluate.
    const module = await import(/* @vite-ignore */ '/src/lib/db/miga-db.ts')
    const database = name && module.db.name !== name ? new module.MigaDatabase(name) : module.db
    try {
      const session = await database.sessions.where('status').anyOf('running', 'paused').first()
      return session
        ? {
            id: session.id,
            goalId: session.goalId,
            startedAt: session.startedAt,
            status: session.status,
          }
        : null
    } finally {
      if (database !== module.db) database.close()
    }
  }, databaseName)
}

async function displayedSeconds(page: Page): Promise<number> {
  const text = await page
    .locator('main p')
    .filter({ hasText: /^\d{2}:\d{2}:\d{2}$/ })
    .innerText()
  const [hours, minutes, seconds] = text.split(':').map(Number)
  return hours * 3_600 + minutes * 60 + seconds
}

for (const failure of ['session-refresh', 'snapshot-revocation'] as const) {
  test(`recovers the same running timer after ${failure} without an empty local panel`, async ({
    page,
  }) => {
    const api = await installStatefulAuthApi(page, [{ email: EMAIL, password: PASSWORD }])
    await page.goto('/login')
    await submitLogin(page)
    await expect(page).toHaveURL(/\/app\/?$/)
    await expect(page.getByRole('heading', { name: 'Inicio', exact: true })).toBeVisible()

    const databaseName = await activeDatabaseName(page)
    const goalId = await seedActiveGoal(page, GOAL_NAME)
    await seedActiveBlob(page)
    await navigateInApp(page, '/app/timer')
    await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
    await page.getByRole('button', { name: GOAL_NAME, exact: true }).click()
    await page.getByRole('button', { name: 'Empezar', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Detener', exact: true })).toBeVisible()
    await expect.poll(() => displayedSeconds(page)).toBeGreaterThan(0)

    const originalTimer = await readActiveTimer(page)
    expect(originalTimer).toMatchObject({ goalId, status: 'running' })
    const secondsBeforeInterruption = await displayedSeconds(page)
    // Wait for the timer row itself to be uploaded, not just an earlier goal mutation.
    await expect
      .poll(() =>
        api
          .getPutBodies()
          .some(({ data }) =>
            (data as { sessions: Array<{ id: string }> }).sessions.some(
              (session) => session.id === originalTimer!.id,
            ),
          ),
      )
      .toBe(true)

    if (failure === 'session-refresh') {
      api.setSessionFailure('401')
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    } else {
      api.failNextSnapshotPutWithRevokedSession()
      await seedActiveGoal(page, 'Meta pendiente al perder acceso')
    }

    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('heading', { name: 'Iniciar sesión', exact: true })).toBeVisible()
    await expect(
      page.getByRole('status').filter({ hasText: 'Tus datos locales se conservan' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Inicio', exact: true })).toHaveCount(0)
    expect(await databaseExists(page, databaseName)).toBe(true)
    expect(await readActiveTimer(page, databaseName)).toEqual(originalTimer)
    expect(await readDatabase(page, databaseName)).toMatchObject({
      goals: expect.arrayContaining([GOAL_NAME]),
      blobs: 1,
    })

    api.setSessionFailure(null)
    // Stay on the recovery screen so its saved return route is retained.
    await submitLogin(page)

    await expect(page).toHaveURL(/\/app\/timer$/)
    await expect(page.getByRole('button', { name: 'Detener', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Iniciar sesión', exact: true })).toHaveCount(0)
    expect(await activeDatabaseName(page)).toBe(databaseName)
    expect(await readActiveTimer(page)).toEqual(originalTimer)
    await expect
      .poll(() => displayedSeconds(page))
      .toBeGreaterThanOrEqual(secondsBeforeInterruption)
  })
}

test('a fresh guest can still start a local timer without being sent to login', async ({
  page,
}) => {
  await installStatefulAuthApi(page)
  await page.goto('/app/timer')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await page.getByRole('button', { name: 'Empezar', exact: true }).click()

  await expect(page).toHaveURL(/\/app\/timer$/)
  await expect(page.getByRole('button', { name: 'Detener', exact: true })).toBeVisible()
  expect(await activeDatabaseName(page)).toBe('miga')
  expect(await readActiveTimer(page)).toMatchObject({ goalId: null, status: 'running' })
})
