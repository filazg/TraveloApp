# Backend deployment — DO test VM (single VM, no LB)

Test VM: `46.101.176.117`. Sve backend servise (13) na jednoj mašini, svi
preko `localhost:<port>` jedan drugog. nginx, SPA buildovi i SSL su izvan
scope-a ovog README-a.

## Što čini "test_do" konfiguraciju

| Sloj | Datoteka | Što radi |
| --- | --- | --- |
| control-service | `travelo-control-service/config/configResolver.js` | bira config po `APP_ENV` env varijabli |
| control-service | `travelo-control-service/config/*.test_do.json` | profili za test (sve URL-ovi `localhost`, DB ide na DO managed cluster) |
| svi servisi (×12) | `travelo-*/config/config.js` | čita `process.env.CONTROL_URL`; default ostaje `http://localhost:5000` |
| pm2 | `ecosystem.config.js` | startup spec sa `APP_ENV=test_do` i `CONTROL_URL=http://localhost:5000` za sve apps |
| skripte | `deploy/install.sh`, `deploy/start.sh` | one-shot install i start (s ordering control-first) |

## Tajne (DB lozinka)

Lozinka DB-a **nije** u repo-u. Pri startu pm2-a iz svog shell-a postavi env:

```bash
export DB_PASS='<paste-pass-here>'   # iz DO panela / password managera
```

Ili dodaj u `~/.bashrc` (ili `/etc/environment`) da preživi reboot. pm2 prosljeđuje `DB_PASS` kroz `ecosystem.config.js` u sve servise; control-service ga injektira u `/database_services_config` response.

## Vremenska zona

Kod svugdje racuna s lokalnim vremenom (`new Date(y, m, d)`, `.setHours()`) —
fiskalni datumi, granice smjena, razdoblja obracuna, filtri po datumu. VM je po
defaultu u UTC-u, pa bi bez ovoga isti upit vratio drugaciji skup zapisa nego
lokalno, a nocni prolaz u 03:00 po Zagrebu (01:00 UTC) vidio bi jos jucerasnji
datum i obracunao pretprosli mjesec.

`ecosystem.config.js` zato postavlja `TZ: 'Europe/Zagreb'` svim node servisima.
Postavi i sistemsku zonu, da se isto vidi i u logovima i u cron-u izvan pm2-a:

```bash
sudo timedatectl set-timezone Europe/Zagreb
date            # mora pokazati CEST/CET, ne UTC
```

## Prvi put na VM-u

```bash
# Prereqs (Ubuntu)
sudo apt update
sudo apt install -y git build-essential
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2

# Code
sudo mkdir -p /opt/TraveloApp && sudo chown $USER /opt/TraveloApp
cd /opt && git clone <repo-url> TraveloApp
cd /opt/TraveloApp

# Deps + start
bash deploy/install.sh
bash deploy/start.sh

# Sustavski startup (jednom — slijedi printovani redak)
pm2 startup
pm2 save
```

## Redeploy

```bash
ssh deploy@46.101.176.117
cd /opt/TraveloApp
git pull
bash deploy/install.sh    # samo ako se promijenio package.json
bash deploy/start.sh      # restart svih servisa s novim kodom
```

Ili minimalno (kad se mijenja samo kod, bez deps):

```bash
git pull && pm2 reload ecosystem.config.js --update-env
```

## SPA-ovi: dev server ili posluženi build

Po zadanom SPA-ovi rade kao **Vite dev server**. Na poslužitelju to znači da
preglednik povuče stotine modula, svaki kao zaseban zahtjev — izmjereno na
testnom VM-u: `react-dom` 982 kB / 4.0 s, `@mui/material` 586 kB / 1.8 s,
prosjek ~1 s po modulu. Nakon `git pull` i restarta Vite baci međuspremnik pa
se sve dohvaća ispočetka i portal se otvara minutama.

Zato na poslužitelju treba **posluženi build**: jedan paket (~2.6 MB) u jednom
zahtjevu. Nginx se ne dira — `vite preview` sluša na istom portu i istom
base putu.

```bash
bash deploy/spa_build.sh          # npm run build za sva tri SPA-a

# prvi put: procesi se moraju podići s novim argumentima
pm2 delete travelo-portal travelo-partner-sales travelo-web-sales
SPA_MODE=preview pm2 start ecosystem.config.js   --only travelo-portal,travelo-partner-sales,travelo-web-sales --update-env
pm2 save
```

Ubuduće je nakon `git pull` dovoljan **samo build** — `vite preview` čita
`dist/` pri svakom zahtjevu, pa restart procesa nije potreban:

```bash
git pull && bash deploy/spa_build.sh
```

Za povratak na dev server: `pm2 delete` pa `pm2 start ecosystem.config.js`
bez `SPA_MODE`.

## Troubleshooting

```bash
pm2 status
pm2 logs travelo-control-service --lines 50
curl http://localhost:5000/health         # mora vratiti {"status":200,"env":"test_do"}
curl http://localhost:5100/               # gateway up?
pm2 logs travelo-auth-service --lines 50  # auth zna se zapetljati na DNS pri startu, retry-a sam
```

## Ports cheat-sheet

| Servis | Port |
|---|---|
| control | 5000 |
| gateway | 5100 |
| auth | 5200 |
| web_portal (BFF) | 6010 |
| channel-terminals | 6020 |
| web-sales-service | 6030 |
| channel-api | 6040 |
| backoffice | 7010 |
| boat | 7020 |
| transactions | 7030 |
| sales | 7040 |
| reports | 7050 |
| booking | 7060 |
| akd | 7070 |

## Portovi SPA-ova i nginx

`ecosystem.config.js` diže SPA-ove kao Vite dev servere na portovima koje nginx
očekuje (`/etc/nginx/sites-enabled/krilo.hr`):

| Putanja u nginxu | proxy_pass | pm2 app |
| --- | --- | --- |
| `/portal/` | `127.0.0.1:5174` | travelo-portal |
| `/partner-sale/` | `127.0.0.1:5175` | travelo-partner-sales |
| `/` | `127.0.0.1:5176` | travelo-web-sales |
| `/app/` | `127.0.0.1:5100` | gateway |
| `/web_sale/` | `127.0.0.1:6030` | web-sales-service |

Ako se portovi u nginxu promijene, prebaci ih bez diranja koda:

```bash
export PORTAL_PORT=5174 PARTNER_SALES_PORT=5175 WEB_SALES_PORT=5176
pm2 restart ecosystem.config.js --update-env
```

Razilaženje ovih portova znači 502 od nginxa — iza njega tada nitko ne sluša.

## Zatvaranje prodaje pred polazak

Web i partnerska prodaja prestaju nuditi polazak 10 minuta prije vremena polaska,
a narudžba za takav polazak se odbija s HTTP 409. Vremena su hrvatska lokalna
(`Europe/Zagreb`) i računaju se eksplicitno u toj zoni, jer VM radi u UTC-u.
Prag se mijenja bez diranja koda, istom varijablom u oba servisa:

```bash
export SALE_CUTOFF_MINUTES=10   # 0 = prodaja do samog polaska
pm2 restart travelo-web-sales-service travelo-sales-service --update-env
```

Šalterska prodaja (boat-desk, terminali) i portal nisu obuhvaćeni — ondje se
karta legitimno izdaje i minutu prije polaska.

Napomena: `--update-env` postojeću varijablu ne uklanja, samo je prepisuje — za
povratak na default vrijednost postavi `WEB_SALES_CUTOFF_MINUTES=10` ili napravi
`pm2 delete` + `pm2 start`.

## Adrese backenda u SPA-ovima

Ne postavljaju se: svaki SPA gađa origin s kojeg je otvoren (`/app` za gateway,
`/web_sale` za web prodaju). `PUBLIC_APP_URL` i `PUBLIC_WEB_SALES_URL` postoje
samo za slučaj da backend nije na istom poslužitelju kao stranica.
