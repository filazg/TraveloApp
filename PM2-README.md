# TraveloApp — PM2 orchestration

Run all 13 services (all except the Electron `travelo-boat-desk`) with a single command.

## One-time setup

```cmd
npm install -g pm2
```

## Start everything

```cmd
start-all.bat
```

This:
1. Boots `travelo-control-service` (port 5000) first.
2. Waits 5 s so it can serve config.
3. Boots the remaining 12 services + 2 frontends.

Frontends:
- `travelo-portal` — http://localhost:5180
- `travelo-web-sales` — http://localhost:5181
- `travelo-boat-desk` (Electron dev renderer) — http://localhost:5182
- `travelo-partner-sales` — http://localhost:5183

## Everyday commands

| Command | Purpose |
|---|---|
| `pm2 status` | table of all apps |
| `pm2 logs` | stream all logs |
| `pm2 logs travelo-auth-service` | stream one app |
| `pm2 restart travelo-auth-service` | restart one app |
| `pm2 stop travelo-auth-service` | stop one app (keeps entry) |
| `pm2 monit` | live CPU/RAM dashboard |
| `stop-all.bat` | remove every TraveloApp app from PM2 |

## Notes

- `travelo-boat-desk` is an Electron GUI app and is intentionally **not** in the ecosystem — start it manually with `npm run dev` inside that folder when needed.
- PM2 auto-restarts a crashed service (up to 20 times with 3 s delay). If a service keeps crashing, check `pm2 logs <name>` — usually it can't reach `control-service` or RabbitMQ.
- To survive reboots (optional): `pm2 save` then `pm2 startup` (Linux/macOS) or `pm2-installer` on Windows.
