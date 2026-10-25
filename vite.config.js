import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [],
      manifest: {
        name: 'NEXAI — sua IA pessoal',
        short_name: 'NEXAI',
        description: 'Sua inteligência artificial pessoal',
        theme_color: '#090b12',
        background_color: '#090b12',
        display: 'standalone',
        start_url: '/',
        icons: []
      }
    })
  ]
});