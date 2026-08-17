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
    // DB_PASS prolazi iz shell env-a na VM-u — control-service ga injektira
    // u response na /database_services_config. Ne hardkodirati ovdje.
    DB_PASS: process.env.DB_PASS,
    TRAVELO_PROFILE: PROFILE,
    ...extraEnv,
  },
});

// Vite dev server (za test fazu — kasnije zamijeniti static buildom).
// `npm install` mora biti pokrenut u SPA folderu da postoji ./node_modules/vite.
const vite = (name, port, basePath) => ({
  name,
  cwd: `./${name}`,
  script: './node_modules/vite/bin/vite.js',
  args: `--host 127.0.0.1 --port ${port} --base ${basePath}`,
  instances: 1,
  autorestart: true,
  restart_delay: 3000,
  max_restarts: 20,
  watch: false,
  env: { NODE_ENV: 'development' },
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
    vite('travelo-portal',         5180, '/portal/'),
    vite('travelo-web-sales',      5182, '/'),
    vite('travelo-partner-sales',  5183, '/partner-sale/'),
  ],
};
