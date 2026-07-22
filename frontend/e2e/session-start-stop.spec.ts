import { expect, test } from '@playwright/test'
import { resetApp } from './helpers/seed'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('starts and stops a free timer session', async ({ page }) => {
  await page.goto('/app/timer')

  await page.getByRole('button', { name: 'Iniciar sesión' }).click()

  // Free session is preselected in GoalPicker; just hit "Empezar".
  await page.getByRole('button', { name: 'Empezar' }).click()

  await expect(page.getByText('Sesión iniciada')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Detener' })).toBeVisible()

  await page.getByRole('button', { name: 'Detener' }).click()

  await expect(page.getByText('Sesión guardada')).toBeVisible()
  // Back to the empty state — the "Iniciar sesión" CTA is visible again.
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toBeVisible()
})
