# OpenCode Server — Deployment Guide

Deployment configuration for the OpenCode AI agent server. This directory is scaffolded into `apps/opencode/` when you run `quark add ai`.

---

## Contents

```
deploy/
├── Dockerfile              # Docker image for Railway deployment
├── railway.json            # Railway deployment configuration
├── config/
│   ├── opencode.json       # OpenCode server configuration (agents, models, providers)
│   └── prompts/
│       ├── assistant.txt   # System prompt for the assistant agent
│       └── researcher.txt  # System prompt for the researcher agent
└── skills/                 # SKILL.md definitions (8 skills)
    ├── accessibility/
    ├── audience-research/
    ├── brand-voice/
    ├── copywriter/
    ├── data-analysis/
    ├── distribution/
    ├── seo/
    └── skill-builder/
```

---

## Railway Deployment

### 1. Create the service

From the Railway dashboard or CLI:

```bash
railway service create opencode
```

### 2. Configure the service

Set the **Root Directory** to `apps/opencode/` in the Railway service settings. This ensures the Docker build context is correct.

### 3. Set environment variables

```bash
railway env set OPENROUTER_API_KEY=sk-or-v1-your-key-here
```

This is the **only** environment variable the OpenCode server needs. The `opencode.json` config reads it via `${OPENROUTER_API_KEY}` interpolation.

### 4. Deploy

```bash
railway up
```

### 5. Verify

```bash
curl http://opencode.railway.internal:4096/health
```

Expected response: `200 OK` with server status JSON.

---

## Internal Networking

Railway services in the same project communicate over a private network. The OpenCode server is reachable at:

```
http://opencode.railway.internal:4096
```

The worker uses this URL when `OPENCODE_SERVER_URL` is not explicitly set. In the worker's `.env`:

```bash
# Production (Railway internal networking)
OPENCODE_SERVER_URL=http://opencode.railway.internal:4096

# Local development (Docker Compose service name)
# OPENCODE_SERVER_URL=http://opencode:4096
```

---

## Dockerfile Details

```dockerfile
FROM oven/bun:1 AS base
RUN bun install -g opencode-ai@latest
RUN mkdir -p /root/.config/opencode
COPY config/opencode.json /root/.config/opencode/opencode.json
COPY config/prompts/ /root/.config/opencode/prompts/
COPY skills/ /root/.config/opencode/skills/
EXPOSE 4096
CMD ["opencode", "serve", "--port", "4096", "--hostname", "0.0.0.0"]
```

Key points:

- Uses **Bun** as the runtime (OpenCode is distributed as an npm package)
- Installs OpenCode globally with `bun install -g`
- Copies config, prompts, and skills into `~/.config/opencode/` (the default config directory)
- Exposes port 4096
- Starts the headless server bound to `0.0.0.0` (required for containerized environments)

---

## Railway Configuration

```json
{
  "build": {
    "builder": "DOCKERFILE",
    "watchPatterns": ["config/**", "skills/**", "Dockerfile", "railway.json"]
  },
  "deploy": {
    "startCommand": "opencode serve --port 4096 --hostname 0.0.0.0",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```

- **Builder:** `DOCKERFILE` — uses the Dockerfile in the root directory
- **Watch patterns:** Only rebuilds when config, skills, or Docker-related files change
- **Restart policy:** Restarts on failure (up to 5 retries)

---

## Local Development with Docker Compose

Add to your `docker-compose.yml`:

```yaml
services:
  opencode:
    build:
      context: ./apps/opencode
      dockerfile: Dockerfile
    ports:
      - "4096:4096"
    environment:
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    volumes:
      - ./apps/opencode/config:/root/.config/opencode
```

Start the service:

```bash
docker compose up -d opencode
```

---

## Updating the Server

### Config changes

If you modify `opencode.json` or prompt files, rebuild and redeploy:

```bash
railway up
```

### OpenCode version updates

The Dockerfile installs `opencode-ai@latest`. To pin a specific version:

```dockerfile
RUN bun install -g opencode-ai@1.17.0
```

### Syncing to CLI templates

After making changes to `packages/opencode/deploy/`, sync to the CLI scaffold templates:

```bash
pnpm --filter @techstream/quark-create-app sync-templates
```

This ensures `quark add ai` scaffolds the latest configuration.

---

## Troubleshooting

| Problem | Likely Cause | Solution |
|---|---|---|
| Build fails with `bun: command not found` | Bun not installed in build environment | Use `FROM oven/bun:1` (already correct in Dockerfile) |
| Server won't start | Port conflict or missing config | Check `--port 4096` is not in use; verify `opencode.json` exists |
| `OPENROUTER_API_KEY` not found | Env var not set or not interpolated | Check Railway env vars; verify `${OPENROUTER_API_KEY}` syntax in config |
| Worker can't reach server | Wrong hostname or network isolation | Use `opencode.railway.internal:4096` on Railway, `opencode:4096` in Docker |
| Config changes not picked up | Docker build cache | Force rebuild: `railway up --build-only --no-cache` |
