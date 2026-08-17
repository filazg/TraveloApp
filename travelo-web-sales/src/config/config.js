// Vite postavlja PROD na true samo u buildu, pa `npm run dev` ide na lokalni
// backend, a build za deploy na testni poslužitelj — bez ručnog prebacivanja
// zastavice, koje se znalo zaboraviti prije builda.
const prod = import.meta.env.PROD

export const url = import.meta.env.VITE_WEB_SALES_URL
    || (prod ? 'https://bookingtest.krilo.hr/web_sale' : 'http://localhost:6030')
export const downloadurl = import.meta.env.VITE_DOWNLOAD_URL
    || (prod ? 'https://admintest.krilo.hr' : 'http://localhost:5100')
