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
| pm2 | `ecosystem.test_do.js` | startup spec sa `APP_ENV=test_do` i `CONTROL_URL=http://localhost:5000` za sve apps |
| skripte | `deploy/install.sh`, `deploy/start.sh` | one-shot install i start (s ordering control-first) |

## Tajne (DB lozinka)

Lozinka DB-a **nije** u repo-u. Pri startu pm2-a iz svog shell-a postavi env:

```bash
export DB_PASS='<paste-pass-here>'   # iz DO panela / password managera
```

Ili dodaj u `~/.bashrc` (ili `/etc/environment`) da preživi reboot. pm2 prosljeđuje `DB_PASS` kroz `ecosystem.test_do.js` u sve servise; control-service ga injektira u `/database_services_config` response.

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
git pull && pm2 reload ecosystem.test_do.js --update-env
```

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
