# OpenClaw Proxy

REST API proxy for OpenClaw CLI. Exposes OpenClaw agent data via simple HTTP endpoints.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your settings
```

## Run

```bash
npm start
# or with auto-reload
npm run dev
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Gateway health check |
| GET | `/api/agents` | List all agents |
| GET | `/api/agents/:id` | Agent detail + sessions |
| GET | `/api/gateway/status` | Gateway status + channels |
| GET | `/api/channels` | List channels |
| GET | `/api/logs?lines=50` | Recent gateway logs |
| POST | `/api/chat` | Send message to agent |

## Auth

Set `API_KEY` in `.env`. Pass via `X-API-Key` header or `?apiKey=` query param.
