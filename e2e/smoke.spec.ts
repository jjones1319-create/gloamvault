import { expect, test, type Page } from '@playwright/test'

/**
 * The smoke on the built app (10-TECH-PLAN §7), on a landscape S25 Ultra profile:
 * 1. Phase 1's: the title, the version, Settings and the performance overlay.
 * 2. Phase 4's loop — 03 §13, the first thirty minutes: New game → the death rule (Mortal, D-088) → a hero → Emberfall → the Waystone → the first delve
 *    (played with the room's Auto-step and the fight's Auto) → home → the Curio Merchant → a Standard Gear Chest;
 *    then a reload keeps the hero (the save).
 */

function watchErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  return errors
}

async function ready(page: Page): Promise<void> {
  await expect(page.locator('html[data-ready="1"]')).toBeAttached({ timeout: 30_000 })
}

async function noSideScroll(page: Page): Promise<void> {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(scrollWidth, 'no horizontal scroll').toBeLessThanOrEqual(892)
}

test('title, version, settings and the performance overlay', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('#title')
  await ready(page)
  await expect(page.getByTestId('version')).toContainText(/v\d+\.\d+\.\d+/)
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()

  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page).toHaveURL(/#settings$/)
  await page.getByTestId('toggle-perf').click()
  await expect(page.getByTestId('toggle-perf')).toHaveAttribute('aria-checked', 'true')

  await page.getByRole('button', { name: 'Back' }).first().click()
  await expect(page).toHaveURL(/#title$/)
  await expect(page.getByTestId('perf-overlay')).toBeVisible()
  await expect(page.getByTestId('perf-overlay')).toContainText(/fps/, { timeout: 5000 })
  await noSideScroll(page)
  expect(errors).toEqual([])
})

/** Plays a delve to its end with the room's Auto-step and the fight's Auto; returns how many steps it took. */
async function playDelve(page: Page): Promise<number> {
  for (let step = 0; step < 600; step++) {
    if (await page.getByTestId('dv-home').isVisible()) return step
    if (await page.getByTestId('dv-continue').isVisible()) {
      await page.getByTestId('dv-continue').click()
      continue
    }
    const auto = page.getByTestId('fx-auto')
    if (await auto.isVisible()) {
      // the fight can end between seeing Auto and reading it: a vanished button is no error, just the next step
      const pressed = await auto.getAttribute('aria-pressed', { timeout: 1000 }).catch(() => null)
      if (pressed !== null && pressed !== 'true') await auto.click({ timeout: 1000 }).catch(() => {})
      await page.waitForTimeout(250)
      continue
    }
    // A curio: the last choice it allows (Leave is last; a choice the party cannot pay for is disabled).
    const curioChoices = page.locator('[data-testid^="dv-curio-"]:enabled')
    if ((await curioChoices.count()) > 0 && (await curioChoices.first().isVisible())) {
      await curioChoices.last().click()
      continue
    }
    const stepBtn = page.getByTestId('dv-action-auto')
    if (await stepBtn.isVisible()) {
      if (await stepBtn.isEnabled()) await stepBtn.click()
      continue
    }
    await page.waitForTimeout(200)
  }
  throw new Error('the delve did not end in 600 steps')
}

test('the first thirty minutes: a hero, the Cellars, home, a chest (03 §13)', async ({ page }) => {
  test.setTimeout(240_000)
  const errors = watchErrors(page)
  await page.goto('#title')
  await ready(page)

  // New game → how death works (Mortal, the game James asked for) → the new-hero stepper.
  await page.getByTestId('new-game').click()
  await page.getByTestId('death-mortal').click()
  await expect(page).toHaveURL(/#new-hero/)
  await page.getByTestId('nh-species-dwarf').click()
  await page.getByTestId('nh-next').click()
  await page.getByTestId('nh-class-warden').click()
  await page.getByTestId('nh-next').click() // the look (Phase 5): a 3D preview, every pick has a default
  await expect(page.getByTestId('nh-look')).toBeVisible()
  await page.getByTestId('nh-look-frame-slight').click()
  await page.getByTestId('nh-next').click() // skills (preselected)
  await page.getByTestId('nh-next').click() // egg
  await page.getByTestId('nh-egg-cellar-hound').click()
  await page.getByTestId('nh-next').click() // points and name
  await page.getByTestId('nh-name').fill('Orrin')
  await page.getByTestId('nh-next').click() // review
  await page.getByTestId('nh-create').click()
  await expect(page).toHaveURL(/#town/)
  await noSideScroll(page)
  // Phase 8: the lesson's first coach mark rings the Waystone (D-038; shown once per profile)
  await expect(page.getByTestId('coach-town-first')).toBeVisible()

  // The Waystone → the first delve (the tutorial floor, D-038).
  await page.getByTestId('town-place-waystone').click()
  await page.getByTestId('waystone-enter').click()
  await expect(page).toHaveURL(/#delve/)
  await ready(page)
  await expect(page.getByTestId('coach-delve-move')).toBeVisible() // the lesson floor's entrance
  await noSideScroll(page)
  await playDelve(page)
  await page.getByTestId('dv-home').click()
  await expect(page).toHaveURL(/#town/)

  // The Curio Merchant: a Standard Gear Chest if the delve paid for one, else the Odds sheet.
  await page.getByTestId('town-place-curio').click()
  const buy = page.getByTestId('cm-buy-standard-gear-chest')
  if (await buy.isEnabled()) {
    await buy.click()
    await page.getByTestId('cm-reveal-close').click()
  } else {
    await page.getByTestId('cm-odds-standard-gear-chest').click()
    await page.keyboard.press('Escape')
  }

  // The save: a reload continues — with Orrin, or (under Mortal, if the first delve went badly) with the selection open.
  await page.goto('#title')
  await page.reload()
  await ready(page)
  await expect(page.getByTestId('continue')).toContainText(/Orrin|choose a new hero/)
  await expect(page.getByTestId('continue')).toContainText('Mortal')
  expect(errors).toEqual([])
})

test('the character viewer: a hero on the plinth, the pickers, back to the title (Phase 5)', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('#viewer=dwarf,warden,S')
  await ready(page)
  await expect(page.getByTestId('viewer-summary')).toContainText('Dwarf Warden')
  await expect(page.getByTestId('viewer-canvas')).toBeVisible()
  await page.getByTestId('vw-species-elf').click()
  await page.getByTestId('vw-class-ranger').click()
  await page.getByTestId('vw-frame-slight').click()
  await expect(page.getByTestId('viewer-summary')).toContainText('Elf Ranger · Slight · tier S')
  await page.getByTestId('viewer-zoom').click()
  await noSideScroll(page)
  await page.getByTestId('back').click()
  await expect(page).toHaveURL(/#title$/)
  expect(errors).toEqual([])
})

test('the room viewer and the monster lineup (Phase 6)', async ({ page }) => {
  const errors = watchErrors(page)
  await page.goto('#room=cel-t-storeroom&monsters=giant-rat,cellar-spider&heroes=1')
  await ready(page)
  await expect(page.getByTestId('room-view-title')).toContainText('cel-t-storeroom')
  await expect(page.getByTestId('room-view-title')).toContainText(/Cellars · (kit|kit \+ grey box|grey box)/)
  await noSideScroll(page)
  await page.goto('#viewer=monsters&zone=cellars')
  await ready(page)
  await expect(page.getByTestId('lineup-title')).toContainText('The Cellars')
  await page.getByTestId('lineup-zone-crypts').click()
  await ready(page)
  await expect(page.getByTestId('lineup-title')).toContainText('The Crypts')
  await noSideScroll(page)
  // The gallery: Rooms opens the zone's first template with its monsters; Next steps on; Back returns to the lineup.
  await page.getByTestId('lineup-rooms').click()
  await ready(page)
  await expect(page.getByTestId('room-view-title')).toContainText(/\(\d+ of \d+\) · Crypts/)
  const first = await page.getByTestId('room-view-title').textContent()
  await page.getByTestId('room-next').click()
  await ready(page)
  await expect(page.getByTestId('room-view-title')).not.toHaveText(first ?? '')
  await noSideScroll(page)
  await page.getByTestId('back').click()
  await ready(page)
  await expect(page.getByTestId('lineup-title')).toContainText('The Crypts')
  // The kit sheet (every piece of a zone's kit) and the effects sheet.
  await page.goto('#viewer=kit&zone=vault')
  await ready(page)
  await expect(page.getByTestId('kit-title')).toContainText('Kit · The Drowned Vault')
  await expect(page.getByTestId('kit-title')).not.toContainText('loading')
  await noSideScroll(page)
  await page.goto('#viewer=fx&still=1')
  await ready(page)
  await expect(page.getByTestId('fx-title')).toContainText('Effects')
  await noSideScroll(page)
  await page.getByTestId('back').click()
  await expect(page).toHaveURL(/#title$/)
  expect(errors).toEqual([])
})

test('the Pacts, the Quest Board and a boss arena (Phase 7)', async ({ page }) => {
  test.setTimeout(120_000)
  const errors = watchErrors(page)
  // The Waystone: Normal and the twelve Pacts; ticking one raises the Oath and shows its reward line.
  await page.goto('#town&place=waystone&demo=1')
  await ready(page)
  await expect(page.getByTestId('waystone-difficulty-normal')).toBeVisible()
  const pact = page.getByTestId('waystone-pact-candle-pact')
  await expect(pact).toBeVisible()
  const before = await page.getByTestId('waystone-oath').textContent()
  await pact.click()
  await expect(page.getByTestId('waystone-oath')).not.toHaveText(before ?? '')
  await noSideScroll(page)
  // The Quest Board: its dailies with progress bars, the turnover and the weekly key caps.
  await page.goto('#town&place=board&demo=1')
  await ready(page)
  await expect(page.getByTestId('qb-turnover')).toBeVisible()
  await expect(page.getByTestId('qb-keys')).toBeVisible()
  await expect(page.locator('[data-testid^="qb-progress-"]').first()).toBeVisible()
  await noSideScroll(page)
  // A boss arena: Sister Naesa's chapel shows the arena line (phase, light, tide) under the banner.
  // a delve link is read when the app boots, so reload after changing the hash
  await page.goto('#delve=gravehollow-keep&floor=7&seed=5&party=warden,blade,mender,arcanist&level=12&room=boss&auto=1')
  await page.reload()
  await ready(page)
  await expect(page.getByTestId('fx-arena')).toBeVisible({ timeout: 30_000 })
  await noSideScroll(page)
  expect(errors).toEqual([])
})

test('the stat tips, the codex and Settings (Phase 8)', async ({ page }) => {
  const errors = watchErrors(page)
  // A stat tip: tap Speed on a hero's Status and read the hero's own number back.
  await page.goto('#hero=hero-1&tab=status&demo=1')
  await ready(page)
  await page.getByTestId('hr-stat-speed').click()
  await expect(page.getByTestId('stat-tip')).toContainText('Speed')
  await noSideScroll(page)
  // The codex: a monster's page, then the materials.
  await page.goto('#codex&demo=1&sample=1')
  await ready(page)
  await expect(page.getByTestId('cx-detail')).toBeVisible()
  await page.getByTestId('tab-materials').click()
  await expect(page.locator('[data-testid^="cx-material-"]').first()).toBeVisible()
  await noSideScroll(page)
  // Settings: Help (replay the lesson) and Sound.
  await page.goto('#settings')
  await ready(page)
  await expect(page.getByTestId('settings-replay-tutorial')).toBeVisible()
  await expect(page.getByTestId('settings-sound')).toBeVisible()
  await noSideScroll(page)
  expect(errors).toEqual([])
})
