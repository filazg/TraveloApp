import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  //base: '/web-sales/',
  base: '/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500
  }
})
