import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  // Isti popis vrijedi i za posluženi build (`vite preview`).
  preview: {
    allowedHosts: ['bookingtest.krilo.hr'],
  },
  server: {
    allowedHosts: ['bookingtest.krilo.hr'],
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
})
