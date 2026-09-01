// PM2 ecosystem for TraveloApp
// Usage:
//   pm2 start ecosystem.config.js                  # starts everything
//   pm2 start ecosystem.config.js --only travelo-control-service
//   pm2 logs <name>
//   pm2 restart <name> | pm2 stop <name> | pm2 delete all
//
// Startup order note:
//   travelo-control-service (port 5000) must be up first — every other
//   service fetches its config from it at boot. Use the start-all.bat /
//   start-all.sh helpers which start control-service, wait, then the rest.
//
// Excluded: travelo-boat-desk — Electron desktop app, not meant to run as a
// headless background process under PM2.

// TRAVELO_PROFILE: prosljeđuje se iz shell env-a (npr. $env:TRAVELO_PROFILE='boat')
// kroz PM2 do svih apps. Backend servisi čitaju ga i šalju controlServiceu pri
// fetch-u DB configa — kontroler tada prependa db_name_prefix iz _profiles bloka.
// Bez env vara → default profil (potpuno backward kompatibilno).
const PROFILE = process.env.TRAVELO_PROFILE || '';

// TRAVELO_SCHEDULERS: lokalni stack NE okida nocne prolaze. Dev i test VM dijele
// iste baze, pa bi oba stacka radila isti posao — dedupe po razdoblju spasava od
// duplikata, ali brojevi izvjestaja i partnerskih racuna idu iz max(...)+1 bez
// zakljucavanja, pa istovremeni prolaz zna dati isti broj. Cronove vrti VM.
// Rucno pokretanje preko POST ruta radi i lokalno, bez obzira na ovu zastavicu;
// za lokalni test cronova pokreni servis bez pm2-a ili privremeno stavi 'on'.

const node = (name, entry) => ({
  name,
  cwd: `./${name}`,
  script: entry,
  instances: 1,
  autorestart: true,
  restart_delay: 3000,
  max_restarts: 20,
  watch: false,
  env: { NODE_ENV: 'development', TRAVELO_PROFILE: PROFILE, TRAVELO_SCHEDULERS: 'off' },
});

const vite = (name, port) => ({
  name,
  cwd: `./${name}`,
  script: './node_modules/vite/bin/vite.js',
  args: `--host --port ${port}`,
  instances: 1,
  autorestart: true,
  restart_delay: 3000,
  max_restarts: 20,
  watch: false,
  env: { NODE_ENV: 'development', TRAVELO_PROFILE: PROFILE },
});

module.exports = {
  apps: [
    // Config hub — must be first
    node('travelo-control-service', 'travelo_control_service.js'),

    // Core backend services
    node('travelo-auth-service', 'travelo_auth_service.js'),
    node('travelo-backoffice-service', 'travelo_backoffice_service.js'),
    node('travelo-boat-service', 'travelo_boat_service.js'),
    node('travelo-gateway-service', 'travelo-gateway_service.js'),
    node('travelo-sales-service', 'travelo_sales_service.js'),
    node('travelo-transactions-service', 'travelo_transactions_service.js'),
    node('travelo-booking-service', 'travelo_booking_service.js'),

    // Channel services
    node('travelo-channel-api-service', 'travelo-channel-api-service.js'),
    node('travelo-channel-terminals-service', 'travelo-channel-terminals-services.js'),

    // Web-facing backends
    node('travelo-web-sales-service', 'travelo_web_sales_service.js'),
    node('travelo-web_portal-service', 'travelo-web_portal-service.js'),

    // Frontends (Vite dev servers)
    vite('travelo-portal', 5180),
    vite('travelo-web-sales', 5181),
    vite('travelo-partner-sales', 5183),
  ],
};
