import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    allowedHosts: ['bookingtest.krilo.hr'],
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
