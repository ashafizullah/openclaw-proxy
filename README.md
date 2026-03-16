# OpenClaw Proxy

REST API proxy for OpenClaw CLI. Exposes OpenClaw agent data via simple HTTP endpoints.

## Why?

OpenClaw communicates via a WebSocket protocol with a complex handshake (device pairing, keypair signing, nonce challenge). This makes it difficult to interact with directly from a web browser or external dashboard.

This proxy runs on the **same machine** as OpenClaw and acts as a bridge — it receives simple HTTP requests, executes OpenClaw CLI commands or reads config files behind the scenes, and returns clean JSON responses.

**Flow:**
```
Browser/Dashboard → HTTPS → Your Server (Nginx) → Tailscale VPN → OpenClaw Machine → Proxy (port 3100) → OpenClaw CLI/Config → JSON
```

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

With PM2 (recommended for production):
```bash
pm2 start index.js --name openclaw-proxy
pm2 save
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

## Tailscale Setup

If you want to access the proxy from a remote server (e.g. your VPS) via Tailscale:

1. **Change OpenClaw gateway bind mode** — by default the gateway only listens on loopback. Edit `~/.openclaw/openclaw.json`:

   ```json
   {
     "gateway": {
       "bind": "lan"
     }
   }
   ```

   Valid bind modes: `loopback`, `lan`, `tailnet`, `custom`, `auto`. Use `lan` to listen on all interfaces (including Tailscale).

2. **Restart the gateway:**

   ```bash
   openclaw gateway restart
   ```

3. **Verify** it shows `bind=lan (0.0.0.0)`:

   ```bash
   openclaw gateway status
   ```

4. **Install Tailscale** on both machines (OpenClaw machine + remote server) and ensure they are connected to the same Tailnet.

5. **Test from your remote server:**

   ```bash
   curl -s -H "X-API-Key: YOUR_API_KEY" http://TAILSCALE_IP:3100/api/agents
   ```

### HTTPS / Mixed Content

If your dashboard runs on HTTPS, browsers will block HTTP requests to the proxy (mixed content). Use an Nginx reverse proxy on your server to handle this:

```nginx
location /openclaw-api/ {
    proxy_pass http://TAILSCALE_IP:3100/;
    proxy_set_header X-API-Key "YOUR_API_KEY";
    proxy_set_header Host $host;
}
```

Then point your dashboard to `https://yourdomain.com/openclaw-api` instead of the direct IP.
