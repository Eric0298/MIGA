/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

function getApiProxyTarget(mode: string): string {
  const raw = loadEnv(mode, process.cwd(), '').VITE_API_PROXY_TARGET?.trim()
  const target = new URL(raw || 'http://localhost:5161')
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) {
    throw new Error('VITE_API_PROXY_TARGET must be an http(s) URL without embedded credentials')
  }
  return target.origin
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
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
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
        runtimeCaching: [
          {
            urlPattern: ({ sameOrigin, url }) =>
              sameOrigin && (url.pathname === '/api' || url.pathname.startsWith('/api/')),
            handler: 'NetworkOnly',
            method: 'GET',
          },
        ],
      },
    }),
  ],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: getApiProxyTarget(mode),
        changeOrigin: false,
        secure: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
}))
