import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  //base: '/web-sales/',
  base: '/',
  plugins: [react()],
  server: {
    allowedHosts: ['bookingtest.krilo.hr'],
  },
  build: {
    chunkSizeWarningLimit: 1500
  }
})
