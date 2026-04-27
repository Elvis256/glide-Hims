import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'

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
  plugins: [react(), tailwindcss()],
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
