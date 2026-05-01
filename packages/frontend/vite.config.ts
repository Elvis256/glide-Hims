import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
// VitePWA disabled — see commented block in plugins. Import retained so the
// kept-for-reference VitePWA() call below still type-checks if re-enabled.
// import { VitePWA } from 'vite-plugin-pwa'
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
    // ⚠️ PWA service worker is currently DISABLED (commented out).
    //
    // The aggressive cache started actively breaking the app: clients held a
    // stale chunk and the SW would serve cached empty arrays for live
    // operational endpoints, making admin/manager queue views appear empty.
    // We replace the previous /sw.js with a self-uninstalling kill-switch
    // (served as a static file) so existing clients clean up automatically.
    //
    // Re-enable only after we have versioned cache busting + a forced-update
    // workflow we trust. See VitePWA() block below — preserved for reference.
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   injectRegister: 'auto',
    //   filename: 'sw.js',
    //   manifest: false,
    //   workbox: {
    //     skipWaiting: true,
    //     clientsClaim: true,
    //     cleanupOutdatedCaches: true,
    //     globPatterns: ['HTML_AND_ASSETS_GLOB'],
    //     navigateFallback: '/index.html',
    //     navigateFallbackDenylist: [/^\/api\//, /^\/socket\.io\//],
    //   },
    //   devOptions: { enabled: false },
    // }),
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
