import { expect, test } from '@playwright/test'

/**
 * Phase 1 smoke: the built app opens on a landscape phone profile without errors, shows the version, and Settings
 * toggles the performance overlay. Phase 4 extends this into new hero → first delve → town → chest.
 */
test('title, version, settings and the performance overlay', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('#title')
  await expect(page.locator('html[data-ready="1"]')).toBeAttached({ timeout: 20_000 })
  await expect(page.getByTestId('version')).toContainText(/v\d+\.\d+\.\d+/)
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()

  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/#settings$/)
  await page.getByTestId('toggle-perf').click()
  await expect(page.getByTestId('toggle-perf')).toHaveAttribute('aria-checked', 'true')

  await page.getByRole('button', { name: 'Back' }).click()
  await expect(page).toHaveURL(/#title$/)
  await expect(page.getByTestId('perf-overlay')).toBeVisible()
  await expect(page.getByTestId('perf-overlay')).toContainText(/fps/, { timeout: 5000 })

  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth, 'no horizontal scroll').toBeLessThanOrEqual(892)
  expect(errors).toEqual([])
})
