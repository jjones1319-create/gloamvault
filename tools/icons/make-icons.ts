/**
 * `npm run icons`: renders client/public/logo.svg into the PWA icon set with the installed Google Chrome through
 * Playwright (no image library needed). Re-run after changing the logo; the PNGs are committed.
 *   pwa-64.png · pwa-192.png · pwa-512.png · maskable-512.png (full-bleed, 20% padding) · apple-touch-icon-180.png
 *   · favicon-48.png
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const PUBLIC = join('client', 'public')
const THEME = '#120f14'
const svg = readFileSync(join(PUBLIC, 'logo.svg'), 'utf8')
const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`

interface Icon {
  file: string
  size: number
  /** 1 = the logo fills the square; less leaves padding on the theme colour (maskable icons need a safe zone). */
  scale: number
  /** Fill the square with the theme colour (true for maskable and apple icons, which must not be transparent). */
  bleed: boolean
}

const ICONS: Icon[] = [
  { file: 'pwa-64.png', size: 64, scale: 1, bleed: false },
  { file: 'pwa-192.png', size: 192, scale: 1, bleed: false },
  { file: 'pwa-512.png', size: 512, scale: 1, bleed: false },
  { file: 'maskable-512.png', size: 512, scale: 0.8, bleed: true },
  { file: 'apple-touch-icon-180.png', size: 180, scale: 0.92, bleed: true },
  { file: 'favicon-48.png', size: 48, scale: 1, bleed: false },
]

const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  const page = await browser.newPage({ deviceScaleFactor: 1 })
  for (const icon of ICONS) {
    await page.setViewportSize({ width: icon.size, height: icon.size })
    const inner = Math.round(icon.size * icon.scale)
    const offset = Math.round((icon.size - inner) / 2)
    await page.setContent(
      `<!doctype html><html><body style="margin:0;width:${icon.size}px;height:${icon.size}px;background:${icon.bleed ? THEME : 'transparent'};overflow:hidden">` +
        `<img src="${dataUrl}" style="position:absolute;left:${offset}px;top:${offset}px;width:${inner}px;height:${inner}px;display:block"></body></html>`,
    )
    await page.waitForLoadState('load')
    await page.screenshot({ path: join(PUBLIC, icon.file), omitBackground: !icon.bleed, type: 'png' })
    console.log(`wrote ${join(PUBLIC, icon.file)} (${icon.size}px)`)
  }
} finally {
  await browser.close()
}
