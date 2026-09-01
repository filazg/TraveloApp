// PM2 ecosystem za DO test, jedan VM (46.101.176.117)
// Sadrži sve backend servise. Web (3 SPA-a) servira nginx kao static.
//
// Usage on VM:
//   pm2 start ecosystem.test_do.js
//   pm2 save
//   pm2 startup        # one-time, da preživi reboot
//
// Startup order: control-service mora biti prvi (na :5000); ostali servisi ga
// fetchaju pri bootu. PM2 startuje sve istovremeno — auth/backoffice/itd. imaju
// retry kod na fetch-u config-a, ali ako vidiš inicijalne greške to je očekivano.

const CONTROL_URL = 'http://localhost:5000';

// TRAVELO_PROFILE: prosljeđuje se iz shell env-a na VM-u kroz PM2 do svih apps.
// Backend servisi šalju ga u POST body kad fetchaju DB config — kontroler
// tada prependa db_name_prefix iz _profiles bloka. Bez env vara → default profil.
const PROFILE = process.env.TRAVELO_PROFILE || '';

const node = (name, entry, extraEnv = {}) => ({
  name,
  cwd: `./${name}`,
  script: entry,
  instances: 1,
  autorestart: true,
  restart_delay: 3000,
  max_restarts: 20,
  watch: false,
  env: {
    NODE_ENV: 'production',
    APP_ENV: 'test_do',
    CONTROL_URL,
    // Kod racuna s lokalnim vremenom: fiskalni datumi, granice smjena, razdoblja
    // izvjestaja i filtri po datumu svi idu kroz new Date(y, m, d) i .setHours().
    // VM je po defaultu u UTC-u, pa bi ista pretraga tamo i ovdje vratila
    // razlicit skup zapisa, a nocni prolaz bi u 03:00 po Zagrebu (01:00 UTC)
    // vidio jos jucerasnji datum i obracunao pretprosli mjesec. TZ se zato
    // postavlja izrijekom i ne oslanja se na sistemsku postavku posluzitelja.
    TZ: 'Europe/Zagreb',
    // DB_PASS prolazi iz shell env-a na VM-u — control-service ga injektira
    // u response na /database_services_config. Ne hardkodirati ovdje.
    DB_PASS: process.env.DB_PASS,
    TRAVELO_PROFILE: PROFILE,
    ...extraEnv,
  },
});

// Vite dev server (za test fazu — kasnije zamijeniti static buildom).
// `npm install` mora biti pokrenut u SPA folderu da postoji ./node_modules/vite.
// SPA-ovi po zadanom gađaju origin s kojeg su otvoreni (vidi helpers/backendUrl),
// pa portal na domeni gađa domenu, a na IP-u taj IP. Ove varijable služe samo
// kad backend NIJE na istom poslužitelju kao stranica — tada ih postavi u shellu
// prije `pm2 restart ecosystem.config.js --update-env`.
const spaEnv = (vars) => Object.fromEntries(Object.entries(vars).filter(([, v]) => !!v));

// PORTOVI SPA-ova MORAJU odgovarati proxy_pass unosima u nginx konfiguraciji
// (/etc/nginx/sites-enabled/krilo.hr). Ako se raziđu, nginx vraća 502 jer iza
// njega nitko ne sluša — a to se već dogodilo kad je repozitorij dizao 5180/5182.
//   /portal/       -> 5174
//   /partner-sale/ -> 5175
//   /              -> 5176   (web prodaja)
const PORTAL_PORT = Number(process.env.PORTAL_PORT) || 5174;
const PARTNER_SALES_PORT = Number(process.env.PARTNER_SALES_PORT) || 5175;
const WEB_SALES_PORT = Number(process.env.WEB_SALES_PORT) || 5176;

// SPA_MODE=preview poslužuje gotov build (`npm run build`), dev server ostaje
// zadano. Razlika je velika na poslužitelju: u dev modu preglednik povuče
// stotine modula, svaki kao zaseban zahtjev — nakon `git pull` i restarta Vite
// baci međuspremnik pa se sve dohvaća ispočetka i stranica se otvara minutama.
// Build je jedan paket.
const SPA_MODE = process.env.SPA_MODE === 'preview' ? 'preview' : 'dev';

const vite = (name, port, basePath, extraEnv = {}) => ({
  name,
  cwd: `./${name}`,
  script: './node_modules/vite/bin/vite.js',
  args: SPA_MODE === 'preview'
    ? `preview --host 127.0.0.1 --port ${port} --base ${basePath}`
    : `--host 127.0.0.1 --port ${port} --base ${basePath}`,
  instances: 1,
  autorestart: true,
  restart_delay: 3000,
  max_restarts: 20,
  watch: false,
  env: { NODE_ENV: SPA_MODE === 'preview' ? 'production' : 'development', ...extraEnv },
});

module.exports = {
  apps: [
    // Config hub — first
    node('travelo-control-service', 'travelo_control_service.js'),

    // Core
    node('travelo-auth-service', 'travelo_auth_service.js'),
    node('travelo-backoffice-service', 'travelo_backoffice_service.js'),
    node('travelo-boat-service', 'travelo_boat_service.js'),
    node('travelo-gateway-service', 'travelo-gateway_service.js'),
    node('travelo-sales-service', 'travelo_sales_service.js'),
    node('travelo-transactions-service', 'travelo_transactions_service.js'),
    node('travelo-booking-service', 'travelo_booking_service.js'),
    node('travelo-akd-service', 'travelo_akd_service.js'),

    // Channel
    node('travelo-channel-api-service', 'travelo-channel-api-service.js'),
    node('travelo-channel-terminals-service', 'travelo-channel-terminals-services.js'),

    // Web-facing BFF backends
    node('travelo-web-sales-service', 'travelo_web_sales_service.js'),
    node('travelo-web_portal-service', 'travelo-web_portal-service.js'),

    // SPA-ovi (Vite dev) — portovi i base se poklapaju s nginx config-om
    vite('travelo-portal',         PORTAL_PORT, '/portal/',       spaEnv({ VITE_BACKEND_URL: process.env.PUBLIC_APP_URL })),
    vite('travelo-web-sales',      WEB_SALES_PORT, '/',             spaEnv({ VITE_WEB_SALES_URL: process.env.PUBLIC_WEB_SALES_URL, VITE_DOWNLOAD_URL: process.env.PUBLIC_DOWNLOAD_URL })),
    vite('travelo-partner-sales',  PARTNER_SALES_PORT, '/partner-sale/', spaEnv({ VITE_BACKEND_URL: process.env.PUBLIC_APP_URL })),
  ],
};
