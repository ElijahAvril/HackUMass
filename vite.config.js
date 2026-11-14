// ---------------------------------------------------------------------------
// Vite + PWA configuration
// ---------------------------------------------------------------------------
// vite-plugin-pwa generates the service worker and the web app manifest for us.
// That is the whole "installable" story: manifest + service worker + icons.
// If you need to change the app name, colours or icons shown on a phone home
// screen, this file is the ONLY place to edit - nothing in src/ reads it.
// ---------------------------------------------------------------------------
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'autoUpdate' = when you deploy a new build, open tabs silently update.
      // Good for a hackathon demo: no "new version available" prompt to wire up.
      registerType: 'autoUpdate',

      // Makes the service worker run during `npm run dev` too, so you can test
      // installability without doing a production build every time.
      devOptions: { enabled: true },

      // Files that get precached for offline use. PackPal is offline-first:
      // all data lives in localStorage, so once cached the app works on a plane.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest,woff,woff2}'],
      },

      // ---- Web app manifest ------------------------------------------------
      // This is what makes "Add to Home Screen" / "Install app" appear.
      manifest: {
        name: 'PackPal',
        short_name: 'PackPal',
        description:
          'Per-event packing checklists with saved kits, built to be accessible.',
        start_url: '/',
        scope: '/',
        display: 'standalone',       // launches without browser chrome
        orientation: 'portrait',
        background_color: '#EADCBE', // splash screen colour (matches paper bg)
        theme_color: '#2B2622',      // status bar colour (matches ink)
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable', // lets Android crop it into its own shape
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/health': 'http://localhost:3000',
      '/speech-to-text': {
        target: 'ws://localhost:3000',
        ws: true,
      },
    },
  },
})
