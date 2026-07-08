/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'brand/miga_app_icon_180.png',
        'brand/miga_app_icon_192.png',
        'brand/miga_app_icon_512.png',
      ],
      manifest: {
        name: 'Miga',
        short_name: 'Miga',
        description: 'Small actions. Big progress.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#FFF7EC',
        theme_color: '#FFF7EC',
        icons: [
          {
            src: '/brand/miga_app_icon_192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/brand/miga_app_icon_512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/brand/miga_app_icon_512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
