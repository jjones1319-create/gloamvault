import { defineConfig, devices } from '@playwright/test'

/**
 * `npm run e2e`: the built app, served by `vite preview`, driven in the installed Google Chrome with a landscape
 * phone profile (the S25 Ultra at its default FHD+ resolution is about 892 x 412 CSS px landscape at DPR 2.625).
 * Builds first. Not part of `npm run verify` or the deploy (10-TECH-PLAN §7).
 */
export const BASE = 'http://localhost:4173/gloamvault/'

export default defineConfig({
  testDir: 'e2e',
  timeout: 150_000,
  expect: { timeout: 10_000 },
  retries: 0,
  reporter: 'list',
  use: { baseURL: BASE, actionTimeout: 10_000, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    {
      name: 's25-landscape',
      use: {
        ...devices['Pixel 7'],
        channel: 'chrome',
        viewport: { width: 892, height: 412 },
        deviceScaleFactor: 2.625,
      },
    },
  ],
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: BASE,
    reuseExistingServer: true,
    timeout: 240_000,
  },
})
