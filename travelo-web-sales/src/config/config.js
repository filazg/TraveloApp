// false = lokalni razvoj (backend na localhost:6030, gateway 5100).
// PRIJE BUILDA ZA DEPLOY prebaciti na true — inače build gađa localhost.
const prod = false

export const url = prod ? 'https://bookingtest.krilo.hr/web_sale' : 'http://localhost:6030'
export const downloadurl = prod ? 'https://admintest.krilo.hr' : 'http://localhost:5100'
