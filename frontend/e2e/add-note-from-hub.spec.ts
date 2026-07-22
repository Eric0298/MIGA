import { expect, test } from '@playwright/test'
import { resetApp, seedGoal } from './helpers/seed'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('adds a text note pinned to multiple goals from the apuntes hub', async ({ page }) => {
  const goalA = await seedGoal(page, 'Meta A')
  const goalB = await seedGoal(page, 'Meta B')

  await page.goto('/app/apuntes')

  await page.getByRole('button', { name: 'Añadir apunte' }).click()

  await page.getByRole('button', { name: 'Texto' }).click()

  // Multi-goal picker: attach the note to both goals.
  await page.getByRole('button', { name: goalA.name }).click()
  await page.getByRole('button', { name: goalB.name }).click()

  await page.locator('input[placeholder="Título del apunte"]').fill('Apunte compartido')
  await page.locator('textarea').fill('Contenido de prueba')

  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Apunte guardado')).toBeVisible()

  // Both goal cards show a "1 apunte" count.
  await expect(
    page.getByRole('link', { name: new RegExp(`${goalA.name}[\\s\\S]*1 apunte`) }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: new RegExp(`${goalB.name}[\\s\\S]*1 apunte`) }),
  ).toBeVisible()
})
