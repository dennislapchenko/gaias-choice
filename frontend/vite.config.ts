import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// SPA build. Content is pulled in at build time via import.meta.glob (see src/lib/content.ts).
export default defineConfig({
  // "/" for local dev and the Cloud Run/nginx container; the GitHub Pages
  // workflow sets BASE_PATH=/gaias-choice/ for the project-page subpath.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: {
    // A leading "." allows the domain and all its subdomains. ngrok free URLs
    // rotate each session, so allow the whole suffix instead of one hostname.
    // Only affects the dev server, never the production nginx container.
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok.io'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
