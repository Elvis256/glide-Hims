import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

// Precache only HTML + chunks. Images/fonts can come from the SWR runtime
// cache (#15: keeps service-worker installs small after each deploy).
import pkg from './package.json'
const APP_VERSION = (pkg as any).version || '0.0.0'

const certsDir = resolve(__dirname, 'certs')
const keyPath = resolve(certsDir, 'key.pem')
const certPath = resolve(certsDir, 'cert.pem')

// Load certs only if they exist (for development)
const hasSSL = existsSync(keyPath) && existsSync(certPath)
const httpsConfig = hasSSL ? {
  key: readFileSync(keyPath),
  cert: readFileSync(certPath),
} : false

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      // Inject our SW into the same /sw.js path the legacy kill-switch lived at,
      // so any client that previously installed the kill-switch upgrades cleanly.
      filename: 'sw.js',
      manifest: false, // we already ship our own /manifest.json
      workbox: {
        // Take control immediately and reload open clients on new deploys.
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // Precache HTML + JS/CSS only (~3 MB instead of 9 MB).
        // Images/fonts/icons load on-demand via the SWR runtime cache below.
        globPatterns: ['**/*.{js,css,html}'],
        // SPA fallback: any navigation hits index.html (handled below as NetworkFirst).
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
        runtimeCaching: [
          {
            // SPA navigations: always try network first so a fresh deploy is
            // visible on the next page load. Fall back to cached HTML offline.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'glide-html',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
          {
            // API: never serve stale; tolerate brief offline reads of GETs only.
            urlPattern: ({ url, request }) =>
              url.pathname.startsWith('/api/') && request.method === 'GET',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'glide-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Hashed JS/CSS — content-addressed, safe to cache forever.
            urlPattern: /\/assets\/.*\.(?:js|css)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'glide-assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Images / fonts.
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'glide-static',
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: {
        // Don't enable the SW during `vite dev` — it complicates HMR.
        enabled: false,
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  build: {
    // Strip console.log/warn in production builds
    minify: 'esbuild',
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
  server: {
    port: 5173,
    host: true,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
  preview: {
    port: 5173,
    host: true,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})
