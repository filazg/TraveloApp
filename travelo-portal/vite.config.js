import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/portal/',
  //base: '/',
  plugins: [react()],
  // Isti popis vrijedi i za posluženi build (`vite preview`).
  preview: {
    allowedHosts: ['bookingtest.krilo.hr'],
  },
  server: {
    allowedHosts: ['bookingtest.krilo.hr'],
    // Kad se portal otvori preko LAN IP-a (npr. s mobitela), SPA gađa
    // `${origin}/app/...` (kao na serveru gdje nginx `/app` -> gateway). U devu
    // toga nema, pa login puca. Ovaj proxy oponaša nginx: `/app/*` ide na lokalni
    // gateway (5100) uz skidanje `/app` prefiksa. Vrijedi SAMO za `npm run dev`
    // (server), ne za `vite preview`/produkciju — ondje i dalje radi nginx.
    proxy: {
      '/app': {
        target: 'http://localhost:5100',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/app/, ''),
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1500
  }
})
