import { expect, test } from '@playwright/test'
import { resetApp, seedGoal } from './helpers/seed'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('adds a text note pinned to multiple goals from the apuntes hub', async ({ page }) => {
  const goalA = await seedGoal(page, 'Meta A')
  const goalB = await seedGoal(page, 'Meta B')

  await page.goto('/app/notas')

  await page.getByRole('button', { name: 'Añadir nota' }).click()

  await page.getByRole('button', { name: 'Texto' }).click()

  // Multi-goal picker: attach the note to both goals.
  await page.getByRole('button', { name: goalA.name }).click()
  await page.getByRole('button', { name: goalB.name }).click()

  await page.locator('input[placeholder="Título de la nota"]').fill('Nota compartida')
  await page.locator('textarea').fill('Contenido de prueba')

  await page.getByRole('button', { name: 'Guardar' }).click()

  await expect(page.getByText('Nota guardada')).toBeVisible()

  // The saved note surfaces in the global list (single row with both goals).
  await expect(page.getByText('Nota compartida')).toBeVisible()
  await expect(page.getByText('1 nota')).toBeVisible()
})
