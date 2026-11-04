import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  // Relative paths support GitHub Pages project repositories.
  base: './',
  plugins: [
    {
      name: 'echo-dev-csp',
      apply: 'serve',
      // Vite injects a development-only refresh script and websocket. Production keeps the strict CSP.
      transformIndexHtml: (html) =>
        html.replace(/<meta\s+http-equiv="Content-Security-Policy"[^>]*>/u, ''),
    },
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['echo.svg'],
      injectManifest: {
        // PWA adds its manifest and icons separately. Avoid duplicate precache entries.
        globPatterns: ['**/*.{js,css,html}'],
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      },
      manifest: {
        name: 'ÉCHO •° — IA locale résonante',
        short_name: 'ÉCHO •°',
        description:
          'Un espace de résonance, entre vous et vos mots. Prototype expérimental local.',
        start_url: './',
        scope: './',
        display: 'standalone',
        lang: 'fr',
        theme_color: '#f7f5ef',
        background_color: '#f7f5ef',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  worker: { format: 'es' },
  build: { target: 'es2022', chunkSizeWarningLimit: 1000 },
  server: { allowedHosts: true },
});
