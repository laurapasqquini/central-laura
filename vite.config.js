import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

// No GitHub Pages o app fica em /central-laura/
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  server: { host: true },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Central da Laura',
        short_name: 'Central',
        description: 'Organização pessoal e profissional: RANKEN, Gralha Azul e vida pessoal',
        theme_color: '#1e1b4b',
        background_color: '#f7f6fb',
        display: 'standalone',
        start_url: base,
        scope: base,
        lang: 'pt-BR',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'], importScripts: ['push-sw.js'] },
    }),
  ],
});
