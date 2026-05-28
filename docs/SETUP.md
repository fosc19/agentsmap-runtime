# Setup

## Requirements

- Node.js 20+
- npm
- Docker / Docker Compose

## Local setup

```bash
npm install
cp .env.example .env
npm run db:up
npm run db:migrate
npm run seed:demo
```

Start services in separate terminals:

```bash
npm run dev:api
npm run dev:web
npm run dev:worker
```

Open:

- `http://localhost:5173`
- `http://localhost:8080/health`
- `http://localhost:8080/ops/map/view`

## Full local demo stack

```bash
npm run dev:stack
npm run dev:stack:status
npm run dev:stack:stop
```

The stack starts the API, web UI and synthetic demo worker. Logs are written to `.runtime-logs/`.

## Notes

This public portfolio version does not require external RPC credentials or external discovery endpoints.
