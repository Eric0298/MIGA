import { expect, test } from '@playwright/test'
import { resetApp, seedGoal, seedQuestions } from './helpers/seed'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('runs a questions exam end-to-end with mixed answers', async ({ page }) => {
  const goal = await seedGoal(page, 'Meta preguntas')
  await seedQuestions(page, goal.id)

  await page.goto(`/app/examenes/${goal.id}/preguntas/nuevo`)

  await page.locator('#questions-exam-title').fill('Examen E2E')
  // Fixed order so we can rely on Pregunta 1 / Pregunta 2 succession.
  await page.getByRole('button', { name: 'Orden original' }).click()

  await page.getByRole('button', { name: 'Empezar examen' }).click()

  await expect(page).toHaveURL(new RegExp(`/app/examenes/${goal.id}/preguntas/[^/]+$`))

  // Question 1: pick the correct answer.
  await expect(page.getByText('Pregunta E2E 1')).toBeVisible()
  await page.getByRole('button', { name: /Correcta 1/ }).click()
  await page.getByRole('button', { name: 'Siguiente' }).click()

  // Question 2: pick the wrong answer so results include a failed one.
  await expect(page.getByText('Pregunta E2E 2')).toBeVisible()
  await page.getByRole('button', { name: /Incorrecta 2/ }).click()
  await page.getByRole('button', { name: 'Terminar examen' }).click()

  await expect(page.getByText('Resultado')).toBeVisible()
  await expect(page.getByText('1 / 2')).toBeVisible()
  // Failed question surfaces with the "Guardar como apunte" bridge.
  await expect(page.getByRole('button', { name: 'Guardar como apunte' })).toBeVisible()
})
