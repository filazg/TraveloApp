# travelo-web-sales-v2 — nova web prodaja

React 18 + Vite, dizajn iz prototipa „Krilo booking" (28.10.2026.). Radi uz staru
web prodaju (`travelo-web-sales`) nad istim backendom (`travelo-web-sales-service`).

## Pokretanje

    npm ci
    npm run dev        # http://localhost:5182, backend na http://localhost:6030
    npm test           # logika košarice (node --test)
    npm run build

Adresa backenda: `VITE_WEB_SALES_URL`; bez nje na poslužitelju `<origin>/web_sale`,
lokalno `http://localhost:6030`.

## Tijek

polazak (luke, datum, polazak iz `/search_trips`) → karte (vrste i cijene s polaska,
otočna karta preko `/check_island_card`) → povratna karta (luke obrnute, količine
kopirane, samo polasci nakon dolaska) → podaci kupca (R1 s provjerom OIB-a u
`/sudreg`) → `/order_confirmation` s `init_payment: true` → Monri → povratak na
`/v2/?order_number=…` → stanje iz `/orders_by_reference`, PDF karte i račun.

Plaćanje pokreće server; merchant key nije u frontendu. Iznos za Monri zbraja
server iz narudžbi koje izradi sales servis. Prikazane cijene su informativne.

## Poslužitelj

- pm2: `travelo-web-sales-v2` u `ecosystem.config.js`, port 5177, base `/v2/`.
- nginx: `location /v2/ { proxy_pass http://127.0.0.1:5177; }` — treba dodati.
- Monri povratak: `/web_sale/monricallback/v2` → `WEB_V2_PATH` (zadano `/v2/`).
- Env za produkciju: `MONRI_FORM_URL`, `MONRI_MERCHANT_KEY`, `MONRI_AUTHENTICITY_TOKEN`
  (zadano su testne vrijednosti).

## Nije preuzeto iz prototipa

Međuluke dolaze iz pretrage (`stops`: segmenti istog polaska koji završavaju prije
odredišta), uz napomenu o iskrcaju. Napomena o Sobri za Mljet bila je ručno upisana
u prototipu i nije preuzeta. Demo kartična forma i HTML dokumenti zamijenjeni su
Monri formom i stvarnim PDF-ovima.
