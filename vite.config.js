import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the build works from any sub-path (e.g. GitHub Pages).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 900,
  },
  plugins: [
    VitePWA({
      // the service worker updates itself when a new version is online
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'Noctis',
        short_name: 'Noctis',
        description: 'Hunt monsters and raise them as your shadow army.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        orientation: 'landscape',
        background_color: '#0b0714',
        theme_color: '#0b0714',
        categories: ['games'],
        icons: [
          { src: 'icons/icon-64.png', sizes: '64x64', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // everything the game needs is cached, so it runs offline
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
});
