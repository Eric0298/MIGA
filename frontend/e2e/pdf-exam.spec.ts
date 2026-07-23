import { expect, test } from '@playwright/test'
import { navigateInApp, resetApp, seedGoal, seedPdfMaterial } from './helpers/seed'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('creates a PDF simulacro and leaves it pending grade', async ({ page }) => {
  const goal = await seedGoal(page, 'Meta simulacro')
  await seedPdfMaterial(page, goal.id, 'Modelo PDF')

  await navigateInApp(page, `/app/examenes/${goal.id}/simulacro/nuevo`)

  await page.locator('#simulacro-title').fill('Simulacro E2E')

  await page.getByRole('button', { name: /Modelo PDF/ }).click()

  await page.getByRole('button', { name: 'Iniciar simulacro' }).click()

  await expect(page).toHaveURL(new RegExp(`/app/examenes/${goal.id}/simulacro/[^/]+$`))
  await expect(page.getByRole('button', { name: 'Terminar' })).toBeVisible()

  await page.getByRole('button', { name: 'Terminar' }).click()

  await page.getByRole('button', { name: 'Dejar pendiente' }).click()

  await expect(page.getByText('Simulacro guardado como pendiente.')).toBeVisible()
  await expect(page.getByText('Simulacro E2E')).toBeVisible()
  await expect(page.getByText('Pendiente de calificar')).toBeVisible()
})
