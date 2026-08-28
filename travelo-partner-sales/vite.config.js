import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Aplikacija se poslužuje pod /partner-sale/. Base mora stajati ovdje, a ne
  // samo kao argument pri pokretanju: u build se upisuju putanje do resursa i
  // BASE_URL koji router uzima za basename. S base '/' izgrađeni index traži
  // /assets/... — ondje stoji web prodaja, pa je stranica ostajala prazna.
  base: '/partner-sale/',
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
