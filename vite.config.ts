import { readFileSync } from 'node:fs'
import { sep } from 'node:path'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig, type Plugin } from 'vite'
import { writeModelIndex } from './tools/build/model-index.ts'

/**
 * Gloamvault lives at https://<user>.github.io/gloamvault/ so every URL starts with BASE (CLAUDE.md gotchas).
 * It must match the GitHub repo name and the manifest id / scope / start_url below. The Vite root is client/
 * (10-TECH-PLAN §3); sim/ and content/ are imported by relative path from there.
 */
export const BASE = '/gloamvault/'
const THEME = '#120f14'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }

/**
 * Phase 5: models are runtime-cached CacheFirst, so every model URL carries a content hash from
 * client/src/scene/characters/modelIndex.json (tools/build/model-index.ts). The index is rewritten at the start of
 * every build and dev server, and in dev whenever a file under client/public/models/ changes.
 */
function modelIndex(): Plugin {
  return {
    name: 'gloamvault-model-index',
    buildStart() {
      writeModelIndex()
    },
    configureServer(server) {
      writeModelIndex()
      server.watcher.on('all', (_event, file) => {
        if (file.includes(`${sep}public${sep}models${sep}`) || file.includes('/public/models/')) writeModelIndex()
      })
    },
  }
}

export default defineConfig({
  root: 'client',
  base: BASE,
  publicDir: 'public',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    modelIndex(),
    preact(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon-48.png', 'apple-touch-icon-180.png', 'logo.svg'],
      manifest: {
        id: BASE,
        scope: BASE,
        start_url: BASE,
        name: 'Gloamvault',
        short_name: 'Gloamvault',
        description: 'An original co-op party dungeon crawler. Delve the keep, fight on the timeline, care for your things.',
        lang: 'en',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        background_color: THEME,
        theme_color: THEME,
        categories: ['games'],
        icons: [
          { src: 'pwa-64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // The app shell and content JSON are precached; 3D models are runtime-cached (10 §2) so the install stays small.
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2,json}'],
        // Phase 8: the audio (manifest and samples) is runtime-cached too, fetched per place on first use (10 §2).
        globIgnores: ['**/models/**', '**/audio/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: `${BASE}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // a RegExp, not a function: workbox copies a function into sw.js as text, where BASE does not exist
            urlPattern: new RegExp(`${BASE}models/`),
            handler: 'CacheFirst',
            options: { cacheName: 'gloamvault-models', expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
          {
            // Phase 8: the audio manifest stays fresh (a stale copy plays while the new one arrives); the samples carry a
            // content hash (`?v=`), so they are cache-first. RegExps, not closures: a function is copied into sw.js as
            // text, where `BASE` does not exist.
            urlPattern: new RegExp(`${BASE}audio/manifest\\.json`),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'gloamvault-audio-manifest' },
          },
          {
            urlPattern: new RegExp(`${BASE}audio/.+\\.ogg`),
            handler: 'CacheFirst',
            options: { cacheName: 'gloamvault-audio', expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
        ],
      },
    }),
  ],
  server: {
    // sim/ and content/ sit beside client/; allow the dev server to serve them.
    fs: { allow: ['..'] },
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const n = id.replace(/\\/g, '/')
          if (n.includes('/node_modules/three/')) return 'three'
          if (n.includes('/sim/src/')) return 'sim'
          if (n.includes('/content/') && n.endsWith('.json')) return 'content'
          return undefined
        },
      },
    },
  },
})
