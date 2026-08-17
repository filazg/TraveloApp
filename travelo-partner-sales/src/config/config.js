// Vite postavlja PROD na true samo u buildu, pa `npm run dev` ide na lokalni
// backend, a build za deploy na testni poslužitelj — bez ručnog prebacivanja
// zastavice, koje se znalo zaboraviti prije builda.
const prod = import.meta.env.PROD

export const backendURL = import.meta.env.VITE_BACKEND_URL
  || (prod ? 'https://bookingtest.krilo.hr/app' : 'http://localhost:5100')

export const salesPath = '/sales_service'
