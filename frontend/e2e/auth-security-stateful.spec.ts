import { expect, test, type Page } from '@playwright/test'
import {
  activeDatabaseName,
  databaseExists,
  installStatefulAuthApi,
  readDatabase,
  readDatabaseDirty,
  seedActiveBlob,
  seedActiveGoal,
  type StatefulAuthApi,
} from './helpers/auth-stateful'

const PASSWORD = 'a-long-unique-password'

async function createGoalThroughUi(page: Page, name: string): Promise<void> {
  await page.goto('/app/metas')
  await page.getByRole('button', { name: 'Nueva meta' }).click()
  await page.locator('#goal-name').fill(name)
  await page
    .getByRole('button', { name: `Día ${new Date().getDate()}` })
    .first()
    .click()
  await page.getByRole('button', { name: 'Crear meta' }).click()
  await expect(page.getByText(name)).toBeVisible()
}

async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña').fill(password)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/app(?:\/)?$/)
  await expect(page.getByText('Guardado', { exact: true }).first()).toBeVisible()
}

async function logout(page: Page): Promise<void> {
  await page.goto('/app/mas')
  await page.getByRole('button', { name: 'Cerrar sesión' }).click()
  await expect(page).toHaveURL(/\/$/)
}

async function submitRegistration(
  page: Page,
  email: string,
  importDemoData: boolean,
): Promise<void> {
  await page.goto('/registro')
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel(/^Contraseña/).fill(PASSWORD)
  await page.getByLabel('Repite la contraseña').fill(PASSWORD)
  await page.getByLabel(/He leído y acepto/).check()
  if (importDemoData) await page.getByLabel(/Copiar los datos de esta demo/).check()
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  await expect(page).toHaveURL(/\/verificar-email/)
}

async function confirmRegistration(
  page: Page,
  api: StatefulAuthApi,
  {
    password = PASSWORD,
    importDemoData = false,
  }: { password?: string; importDemoData?: boolean } = {},
): Promise<void> {
  const userId = api.getPendingUserId()
  expect(userId).not.toBeNull()
  await page.goto('/')
  await page.goto(`/verificar-email#userId=${userId}&token=stateful-confirmation`)
  if (importDemoData) {
    await expect(page.getByLabel(/Copiar los datos de esta demo/)).toBeChecked()
  }
  await page.getByLabel(/^Nueva contraseña/).fill(password)
  await page.getByLabel('Repite la contraseña').fill(password)
  await page.getByLabel(/He leído y acepto/).check()
  await page.getByRole('button', { name: 'Verificar correo' }).click()
  await expect(page).toHaveURL(/\/app(?:\/)?$/)
  await expect(page.getByText('Guardado', { exact: true }).first()).toBeVisible()
}

test('local mode survives an auth network failure and persists after reload', async ({ page }) => {
  const api = await installStatefulAuthApi(page)
  api.setSessionFailure('network')

  await createGoalThroughUi(page, 'Meta local sin red')
  expect(await activeDatabaseName(page)).toBe('miga')

  await page.reload()

  await expect(page.getByText('Meta local sin red')).toBeVisible()
  expect(await readDatabase(page)).toEqual({ goals: ['Meta local sin red'], blobs: 0 })
})

test('demo creates one isolated scope and keeps it across reloads', async ({ page }) => {
  await installStatefulAuthApi(page)

  await page.goto('/demo')
  await expect(page).toHaveURL(/\/app(?:\/)?$/)
  const databaseName = await activeDatabaseName(page)
  expect(databaseName).toMatch(/^miga-scoped-/)
  await createGoalThroughUi(page, 'Meta demo persistente')

  await page.reload()

  expect(await activeDatabaseName(page)).toBe(databaseName)
  await expect(page.getByText('Meta demo persistente')).toBeVisible()
})

test('demo conversion keeps its scope, structured data and local blobs', async ({ page }) => {
  const api = await installStatefulAuthApi(page)
  await page.goto('/demo')
  await expect(page).toHaveURL(/\/app(?:\/)?$/)
  await expect(page.getByText('Guardado', { exact: true }).first()).toBeVisible()
  const demoDatabase = await activeDatabaseName(page)
  await seedActiveGoal(page, 'Meta convertida')
  await seedActiveBlob(page)
  await expect.poll(() => api.getPutBodies().length).toBeGreaterThan(0)
  await expect(page.getByText('Guardado', { exact: true }).first()).toBeVisible()

  await submitRegistration(page, 'converted@example.test', true)
  await confirmRegistration(page, api, { importDemoData: true })

  expect(await activeDatabaseName(page)).toBe(demoDatabase)
  expect(await readDatabase(page)).toEqual({ goals: ['Meta convertida'], blobs: 1 })
})

test('registration, confirmation, logout and login retain the account scope', async ({ page }) => {
  const api = await installStatefulAuthApi(page)
  const email = 'registered@example.test'

  await submitRegistration(page, email, false)
  await confirmRegistration(page, api)
  await createGoalThroughUi(page, 'Meta registrada')
  await seedActiveBlob(page)
  await expect.poll(() => api.getPutBodies().length).toBeGreaterThan(0)
  await expect(page.getByText('Guardado', { exact: true }).first()).toBeVisible()
  const accountDatabase = await activeDatabaseName(page)

  await logout(page)

  expect(await databaseExists(page, accountDatabase)).toBe(true)
  expect(await readDatabase(page, accountDatabase)).toEqual({
    goals: ['Meta registrada'],
    blobs: 1,
  })
  await page.goto('/app')
  expect(await activeDatabaseName(page)).toBe('miga')

  await login(page, email)

  expect(await activeDatabaseName(page)).toBe(accountDatabase)
  expect(await readDatabase(page)).toEqual({ goals: ['Meta registrada'], blobs: 1 })
})

test('two registered identities never expose each other local data', async ({ page }) => {
  await installStatefulAuthApi(page, [
    { email: 'a@example.test', password: PASSWORD },
    { email: 'b@example.test', password: PASSWORD },
  ])

  await login(page, 'a@example.test')
  const databaseA = await activeDatabaseName(page)
  await seedActiveGoal(page, 'Solo A')
  await expect(page.getByText('Guardado', { exact: true }).first()).toBeVisible()
  await logout(page)

  await login(page, 'b@example.test')
  const databaseB = await activeDatabaseName(page)
  expect(databaseB).not.toBe(databaseA)
  expect((await readDatabase(page)).goals).toEqual([])
  await seedActiveGoal(page, 'Solo B')
  await expect(page.getByText('Guardado', { exact: true }).first()).toBeVisible()
  await logout(page)

  await login(page, 'a@example.test')
  expect(await activeDatabaseName(page)).toBe(databaseA)
  expect((await readDatabase(page)).goals).toEqual(['Solo A'])
})

test('a 401 closes but does not delete the account scope', async ({ page }) => {
  const api = await installStatefulAuthApi(page, [
    { email: 'expired@example.test', password: PASSWORD },
  ])
  await login(page, 'expired@example.test')
  const accountDatabase = await activeDatabaseName(page)
  await seedActiveBlob(page)
  api.setSessionFailure('401')

  await page.reload()

  expect(await activeDatabaseName(page)).toBe('miga')
  expect(await databaseExists(page, accountDatabase)).toBe(true)
  expect((await readDatabase(page, accountDatabase)).blobs).toBe(1)
})

test('a snapshot PUT 401 revalidates revocation and retains dirty scoped data', async ({
  page,
}) => {
  const api = await installStatefulAuthApi(page, [
    { email: 'revoked-sync@example.test', password: PASSWORD },
  ])
  await login(page, 'revoked-sync@example.test')
  const accountDatabase = await activeDatabaseName(page)
  await seedActiveGoal(page, 'Guardada antes de revocar')
  await seedActiveBlob(page)
  await expect.poll(() => api.getPutBodies().length).toBeGreaterThan(0)

  api.failNextSnapshotPutWithRevokedSession()
  await seedActiveGoal(page, 'Pendiente tras revocar')

  await expect.poll(async () => activeDatabaseName(page)).toBe('miga')
  expect(await databaseExists(page, accountDatabase)).toBe(true)
  const retained = await readDatabase(page, accountDatabase)
  expect(retained.blobs).toBe(1)
  expect(retained.goals).toHaveLength(2)
  expect(retained.goals).toEqual(
    expect.arrayContaining(['Guardada antes de revocar', 'Pendiente tras revocar']),
  )
  expect(await readDatabaseDirty(page, accountDatabase)).toBe(true)
})

test('an unconfirmed registered session cannot enter authenticated app routes', async ({
  page,
}) => {
  await installStatefulAuthApi(page, [
    {
      email: 'unconfirmed@example.test',
      password: PASSWORD,
      emailConfirmed: false,
    },
  ])

  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('unconfirmed@example.test')
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()

  await expect(page).toHaveURL(/\/verificar-email/)
  await expect(page.getByRole('heading', { name: 'Verificar correo' })).toBeVisible()
})

test('explicit local deletion signs out and never uploads an empty snapshot', async ({ page }) => {
  const api = await installStatefulAuthApi(page, [
    { email: 'delete@example.test', password: PASSWORD },
  ])
  await login(page, 'delete@example.test')
  const accountDatabase = await activeDatabaseName(page)
  await seedActiveGoal(page, 'Conservar en servidor')
  await seedActiveBlob(page)
  await expect.poll(() => api.getPutBodies().length).toBeGreaterThan(0)
  await expect(page.getByText('Guardado', { exact: true }).first()).toBeVisible()
  const putsBeforeDelete = api.getPutBodies()

  await page.goto('/app/mas')
  await page.getByRole('button', { name: /^Borrar todos los datos/ }).click()
  await page.getByRole('button', { name: 'Borrar localmente y cerrar sesión' }).click()
  await expect.poll(async () => activeDatabaseName(page)).toBe('miga')
  await expect.poll(() => api.getPutBodies().length).toBe(putsBeforeDelete.length)

  expect(await databaseExists(page, accountDatabase)).toBe(false)
  expect(api.getCurrentWorkspaceId()).toBeNull()
  expect(api.getPutBodies()).toHaveLength(putsBeforeDelete.length)
  expect((putsBeforeDelete.at(-1)?.data as { goals?: unknown[] } | undefined)?.goals).toHaveLength(
    1,
  )
})

test('active-session controls load through reauthentication', async ({ page }) => {
  await installStatefulAuthApi(page, [{ email: 'sessions@example.test', password: PASSWORD }])
  await login(page, 'sessions@example.test')
  await page.goto('/app/mas')

  await page.getByText('Sesiones activas').click()
  const sessionsSection = page.locator('details').filter({ hasText: 'Sesiones activas' })
  await sessionsSection.getByLabel('Contraseña actual').fill(PASSWORD)
  await sessionsSection.getByRole('button', { name: 'Mostrar sesiones' }).click()

  await expect(sessionsSection.getByText('Este dispositivo')).toBeVisible()
})

test('confirmed account deletion revokes access and removes only its scoped database', async ({
  page,
}) => {
  const api = await installStatefulAuthApi(page, [
    { email: 'account-delete@example.test', password: PASSWORD },
  ])
  await login(page, 'account-delete@example.test')
  const accountDatabase = await activeDatabaseName(page)
  await seedActiveBlob(page)
  await page.goto('/app/mas')

  await page.getByText('Eliminar cuenta', { exact: true }).click()
  const deletion = page.locator('details').filter({ hasText: 'Eliminar cuenta' })
  await deletion.getByLabel('Contraseña actual').fill(PASSWORD)
  await deletion.getByLabel('Escribe DELETE').fill('DELETE')
  await deletion.getByRole('button', { name: 'Eliminar mi cuenta' }).click()

  await expect(page).toHaveURL(/\/$/)
  expect(api.getCurrentWorkspaceId()).toBeNull()
  expect(await databaseExists(page, accountDatabase)).toBe(false)

  await page.goto('/login')
  await page.getByLabel('Correo electrónico').fill('account-delete@example.test')
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('alert')).toBeVisible()
})
