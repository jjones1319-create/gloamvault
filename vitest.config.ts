import preact from '@preact/preset-vite'
import { defineConfig } from 'vitest/config'

/** Unit tests for the sim, the client's pure modules and the tools: `npm test` (part of `npm run verify`). */
export default defineConfig({
  plugins: [preact()],
  test: {
    environment: 'node',
    include: ['sim/test/**/*.test.ts', 'client/src/**/*.test.ts', 'tools/**/*.test.ts'],
    testTimeout: 60_000,
  },
})
