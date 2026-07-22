import { expect, test } from '@playwright/test'
import { resetApp } from './helpers/seed'

test.beforeEach(async ({ page }) => {
  await resetApp(page)
})

test('creates a goal from the goals page', async ({ page }) => {
  await page.goto('/app/metas')

  await page.getByRole('button', { name: 'Nueva meta' }).click()

  await page.locator('#goal-name').fill('Meta smoke test')

  // Pick today: the first "Día N" button whose N matches today's day-of-month.
  const today = new Date().getDate()
  await page.getByRole('button', { name: `Día ${today}` }).first().click()

  await page.getByRole('button', { name: 'Crear meta' }).click()

  await expect(page.getByText('Meta creada')).toBeVisible()
  await expect(page.getByText('Meta smoke test')).toBeVisible()
})
