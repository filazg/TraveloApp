import { defineConfig } from 'vite';

// Domene s kojih nginx prosljeđuje na Vite; bez popisa Vite 6 odbija zahtjev
// ("Blocked request. This host is not allowed"). Isti popis vrijedi i za
// posluženi build (`vite preview`, SPA_MODE=preview na VM-u).
const allowedHosts = ['bookingtest.krilo.hr', 'webbookingtest.krilo.hr'];

export default defineConfig({
  // Poslužuje se na korijenu domene (umjesto stare web prodaje).
  base: '/',
  preview: { allowedHosts },
  server: { allowedHosts },
});
