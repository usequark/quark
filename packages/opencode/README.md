# OpenCode AI Integration

Part of the [Quark monorepo](https://github.com/techstream/quark). This package provides the configuration, skills, plugins, and deployment tooling for integrating [OpenCode](https://opencode.ai) AI agents into Quark projects.

---

## 1. Overview

The AI feature connects your Quark application to AI agents through a multi-layer pipeline:

```
Next.js API Route → BullMQ Queue → Worker Handler → OpenCode SDK → OpenCode Server → OpenRouter → AI Model
```

**Key components:**

- **OpenCode Server** — A headless AI agent server that manages sessions, dispatches prompts to LLMs, and exposes a REST API (port 4096). Runs as a separate Railway service.
- **OpenRouter** — The model gateway. All LLM calls are routed through OpenRouter, which provides access to dozens of models (DeepSeek, Gemini, GPT, Claude, etc.) through a single API key.
- **BullMQ Worker** — Background job processing. The worker receives AI tasks from your application, communicates with the OpenCode server via the TypeScript SDK, and returns results asynchronously.
- **Custom Plugin** — Techstream-specific hooks and tools that extend OpenCode with quality gates, output composition, CMS publishing, and brand compliance checks.

**Design principles:**

- **HTTP, not stdio** — The OpenCode server exposes a REST API (OpenAPI 3.1) for decoupled worker communication over Railway internal networking.
- **Stateless workers** — Each BullMQ job carries full context (prompt, agent, session title). No shared state between jobs.
- **No fork** — Zero modifications to OpenCode source code. All customization is done via configuration, plugins, and the TypeScript SDK.
- **OpenRouter as model gateway** — All LLM calls go through OpenRouter, giving you access to every major model provider with a single API key and unified billing.

---

## 2. Quick Start

### Adding AI to a new project

When scaffolding a new Quark project, include the AI feature:

```bash
npx @techstream/quark-create-app my-app --features ai
```

Or select it interactively from the feature picker.

### Adding AI to an existing project

```bash
quark add ai
```

This command does the following:

1. **Creates `apps/opencode/`** — Copies the OpenCode server template (Dockerfile, railway.json, config, skills) from `packages/opencode/deploy/` into your project.
2. **Adds `@opencode-ai/sdk`** to `apps/worker/package.json` dependencies.
3. **Migrates the worker** by running `migrate-worker.js`, which:
   - Adds `AI: "ai-queue"` to `JOB_QUEUES` in `packages/jobs/src/definitions.js`
   - Adds `AI_AGENT_TASK`, `AI_SESSION_CREATE`, and `AI_HEALTH_CHECK` to `JOB_NAMES`
   - Creates `apps/worker/src/handlers/ai.js` with three handler functions
   - Wires the handlers into `apps/worker/src/handlers/index.js`
   - Adds `OPENCODE_SERVER_URL` and `OPENROUTER_API_KEY` to `.env.example`

### Prerequisites

- **Docker** — Required for local development (PostgreSQL + Redis for BullMQ)
- **OpenRouter API key** — Get one at [openrouter.ai](https://openrouter.ai/keys)
- **pnpm** — Package manager for the monorepo

---

## 3. Configuration

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `OPENROUTER_API_KEY` | **Yes** | — | OpenRouter API key. Get one at [openrouter.ai/keys](https://openrouter.ai/keys). Used by the OpenCode server to authenticate with OpenRouter. |
| `OPENCODE_SERVER_URL` | No | `http://opencode:4096` | Base URL of the OpenCode server. In production on Railway, this uses internal networking (`http://opencode.railway.internal:4096`). The worker handler falls back to `http://opencode:4096` (Docker Compose service name) if not set. |

### Setting up OpenRouter

1. Create an account at [openrouter.ai](https://openrouter.ai)
2. Generate an API key from the [keys page](https://openrouter.ai/keys)
3. Add it to your environment:

```bash
# .env
OPENROUTER_API_KEY=sk-or-v1-your-key-here
OPENCODE_SERVER_URL=http://opencode:4096
```

The OpenCode server reads `OPENROUTER_API_KEY` from its environment and injects it into the OpenRouter provider configuration via `${OPENROUTER_API_KEY}` interpolation in `opencode.json`.

---

## 4. OpenCode Config Reference

The `opencode.json` file is the central configuration for the OpenCode server. It defines models, providers, agents, permissions, and MCP servers.

### File Location

- **Global config:** `~/.config/opencode/opencode.json` (shared across all projects)
- **Per-project config:** `apps/opencode/config/opencode.json` (scaffolded with `quark add ai`)

### Model Field Format

The `model` field uses the format:

```
provider/model-name
```

Where `provider` is the OpenCode provider prefix and `model-name` is what the provider expects.

**Examples:**

| Value | Provider | Model |
|---|---|---|
| `openrouter/deepseek/deepseek-v4-flash` | OpenRouter | `deepseek/deepseek-v4-flash` |
| `openrouter/deepseek/deepseek-v4-pro` | OpenRouter | `deepseek/deepseek-v4-pro` |
| `openrouter/google/gemini-3.5-flash` | OpenRouter | `google/gemini-3.5-flash` |
| `openrouter/openai/gpt-4o-mini` | OpenRouter | `openai/gpt-4o-mini` |

### Provider Configuration

```json
{
  "provider": {
    "openrouter": {
      "apiKey": "${OPENROUTER_API_KEY}"
    }
  }
}
```

Environment variable interpolation uses the `${VAR_NAME}` syntax. The OpenCode server resolves these at startup from its environment.

### Available Providers

| Provider ID | Description |
|---|---|
| `openrouter` | OpenRouter gateway — access to 200+ models from all major providers |
| `openai` | Direct OpenAI API (bypasses OpenRouter) |
| `anthropic` | Direct Anthropic API (bypasses OpenRouter) |
| `google` | Direct Google AI API (bypasses OpenRouter) |

> **Recommendation:** Use `openrouter` for all models. It provides unified billing, fallback routing, and access to models from every provider through a single API key.

### Full Config Structure

```json
{
  "$schema": "https://opencode.ai/config.json",

  "model": {
    "default": "openrouter/deepseek/deepseek-v4-flash"
  },

  "provider": {
    "openrouter": {
      "apiKey": "${OPENROUTER_API_KEY}"
    }
  },

  "agent": {
    "build": { "disable": true },
    "plan": { "disable": true },
    "assistant": {
      "mode": "primary",
      "description": "General-purpose AI assistant with full tool access",
      "model": "openrouter/deepseek/deepseek-v4-flash",
      "temperature": 0.3,
      "permission": {
        "read": "allow",
        "edit": "allow",
        "bash": "allow",
        "glob": "allow",
        "grep": "allow",
        "list": "allow",
        "task": "allow",
        "todowrite": "allow",
        "webfetch": "allow",
        "skill": "allow"
      }
    },
    "researcher": {
      "mode": "subagent",
      "description": "Read-only research agent",
      "model": "openrouter/deepseek/deepseek-v4-flash",
      "temperature": 0.2,
      "permission": {
        "read": "allow",
        "glob": "allow",
        "grep": "allow",
        "list": "allow",
        "webfetch": "allow",
        "skill": "allow",
        "edit": "deny",
        "bash": "deny"
      },
      "prompt": "{file:./prompts/researcher.txt}"
    }
  },

  "permission": {
    "edit": "ask",
    "bash": "ask"
  }
}
```

### Per-Agent Model Overrides

Each agent can override the default model:

```json
{
  "agent": {
    "orchestrator": {
      "model": "openrouter/deepseek/deepseek-v4-pro",
      "temperature": 0.3
    },
    "reviewer": {
      "model": "openrouter/google/gemini-3.5-flash",
      "temperature": 0.4
    }
  }
}
```

### Permission Levels

| Value | Meaning |
|---|---|
| `"allow"` | Agent can use this tool freely |
| `"deny"` | Agent cannot use this tool |
| `"ask"` | Agent must ask for permission before using this tool |

### Agent Isolation Models

Three levels of data isolation between agents:

- **Model A — Shared Project Root (weakest):** All agents share one `.opencode/` directory. Isolation is by convention (agent prompts + permissions). Suitable for internal tools, low-sensitivity data.
- **Model B — Separate Project Roots (moderate):** Each domain gets its own directory with its own `.opencode/`. The `x-opencode-directory` header controls which files each session sees. Suitable for multi-department projects with moderate data sensitivity.
- **Model C — Separate Servers (strongest):** Each domain runs its own OpenCode server (separate Railway service). Complete process, filesystem, and database isolation. Required for financial data, PII, regulated industries.

---

## 5. Architecture

### Data Flow

```
┌─────────────┐     ┌──────────┐     ┌──────────────┐     ┌───────────────┐
│  Next.js    │────▶│  BullMQ  │────▶│  Worker      │────▶│  OpenCode     │
│  API Route  │     │  Queue   │     │  Handler     │     │  SDK (HTTP)   │
└─────────────┘     └──────────┘     └──────────────┘     └───────┬───────┘
                                                                  │
                                                                  ▼
                                                         ┌──────────────────┐
                                                         │  OpenCode Server │
                                                         │  (port 4096)     │
                                                         └────────┬─────────┘
                                                                  │
                                                                  ▼
                                                         ┌──────────────────┐
                                                         │  OpenRouter      │
                                                         │  (API Gateway)   │
                                                         └────────┬─────────┘
                                                                  │
                                            ┌─────────────────────┼─────────────────────┐
                                            ▼                     ▼                     ▼
                                     ┌────────────┐       ┌────────────┐       ┌────────────┐
                                     │  DeepSeek  │       │   Gemini   │       │    GPT     │
                                     │    V4      │       │   3.5      │       │   4o       │
                                     └────────────┘       └────────────┘       └────────────┘
```

### Service Topology (Railway)

```
┌─────────────────────────────────────────────────────────┐
│                    Railway Project                       │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │
│  │  Web App    │  │  Worker      │  │  OpenCode      │  │
│  │  :3000      │  │  (BullMQ)    │  │  Server :4096  │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬────────┘  │
│         │                │                   │           │
│         │         ┌──────┴───────┐           │           │
│         │         │  Redis       │           │           │
│         │         └──────────────┘           │           │
│         │                                    │           │
│         └──────────────┬─────────────────────┘           │
│                        │                                 │
│                 ┌──────┴───────┐                         │
│                 │  PostgreSQL  │                         │
│                 └──────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

### Key Design Decisions

- **HTTP, not stdio** — The OpenCode server exposes a REST API (OpenAPI 3.1). The worker communicates over HTTP, which is more reliable in containerized environments than stdio-based IPC.
- **Stateless workers** — Each BullMQ job carries full context (prompt, agent, session title). No shared state between workers, making horizontal scaling trivial.
- **Dynamic import** — The worker uses `await import("@opencode-ai/sdk")` (dynamic import) so the SDK is only loaded when AI jobs are actually processed. This keeps the worker lightweight when AI isn't configured.
- **Railway internal networking** — Services communicate over Railway's private network using `.railway.internal` hostnames, keeping traffic off the public internet.

---

## 6. Job Handlers

Three job handlers are registered when AI is added to a project:

### `handleAiAgentTask`

Sends a prompt to an AI agent and returns the response.

**Job data:**

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `prompt` | `string` | Yes | — | The prompt text to send to the agent |
| `agent` | `string` | No | `"assistant"` | The agent to use (e.g., `"assistant"`, `"strategist"`, `"researcher"`) |
| `sessionTitle` | `string` | No | `"AI Task: {agent}"` | Optional title for the session |

**Returns:**

```json
{
  "sessionId": "uuid",
  "output": { ... }
}
```

**Errors:**

| Code | HTTP Status | Condition |
|---|---|---|
| `AI_PROMPT_REQUIRED` | 400 | No `prompt` field in job data |
| `AI_AGENT_TASK_FAILED` | 502 | OpenCode server returned an error or is unreachable |

**Usage example (from a Next.js API route):**

```javascript
import { createQueue } from "@scope/jobs";
import { JOB_QUEUES, JOB_NAMES } from "@scope/jobs";

const aiQueue = createQueue(JOB_QUEUES.AI);

export async function POST(request) {
  const { prompt, agent } = await request.json();

  const job = await aiQueue.add(JOB_NAMES.AI_AGENT_TASK, {
    prompt,
    agent: agent || "assistant",
    sessionTitle: "Content generation request",
  });

  return Response.json({ jobId: job.id });
}
```

### `handleAiSessionCreate`

Creates a new OpenCode session and returns the session ID. Useful when you need to maintain a conversation across multiple prompts.

**Job data:**

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `title` | `string` | No | `"AI Session"` | Optional title for the session |

**Returns:**

```json
{
  "sessionId": "uuid"
}
```

**Errors:**

| Code | HTTP Status | Condition |
|---|---|---|
| `AI_SESSION_CREATE_FAILED` | 502 | OpenCode server returned an error or is unreachable |

### `handleAiHealthCheck`

Checks the OpenCode server's health by calling `GET /health`.

**Job data:** None required.

**Returns:**

```json
{
  "status": "ok",
  "serverStatus": { ... }
}
```

**Errors:**

| Code | HTTP Status | Condition |
|---|---|---|
| `AI_HEALTH_CHECK_FAILED` | 502 | Health check request failed |

---

## 7. Creating Custom Agents

You can define custom agents in `opencode.json` with specific models, permissions, and system prompts.

### Basic Agent Definition

```json
{
  "agent": {
    "accounting": {
      "mode": "subagent",
      "description": "Processes financial data and generates reports",
      "model": "openrouter/deepseek/deepseek-v4-flash",
      "temperature": 0.1,
      "permission": {
        "read": "allow",
        "bash": "deny",
        "edit": "deny"
      },
      "prompt": "{file:./prompts/accounting.txt}"
    }
  }
}
```

### Agent Configuration Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `mode` | `string` | Yes | `"primary"` (can delegate to sub-agents) or `"subagent"` (receives tasks from primary) |
| `description` | `string` | Yes | Human-readable description of the agent's role |
| `model` | `string` | No | Model override (defaults to `model.default`). Format: `provider/model-name` |
| `temperature` | `number` | No | Model temperature (0.0–1.0). Lower = more deterministic, higher = more creative |
| `permission` | `object` | Yes | Tool permissions (`"allow"`, `"deny"`, `"ask"`) |
| `prompt` | `string` | No | System prompt. Can reference a file with `{file:./path/to/prompt.txt}` |
| `disable` | `boolean` | No | Set to `true` to disable a built-in agent |

### Permission Reference

Available tools for permission control:

| Tool | Description |
|---|---|
| `read` | Read files from the filesystem |
| `edit` | Edit/create/delete files |
| `bash` | Execute shell commands |
| `glob` | Search for files by pattern |
| `grep` | Search file contents |
| `list` | List directory contents |
| `task` | Delegate tasks to sub-agents |
| `todowrite` | Write to todo lists |
| `webfetch` | Fetch web pages |
| `skill` | Load skills |

### Adding MCP Servers

MCP (Model Context Protocol) servers give agents access to external tools:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-playwright"],
      "transport": "stdio"
    },
    "github": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-github"],
      "transport": "stdio"
    }
  }
}
```

### Techstream Internal Agents

The monorepo's `packages/opencode/config/opencode.json` defines five specialized agents for the asset production pipeline:

| Agent | Mode | Model | Temperature | Permissions | Role |
|---|---|---|---|---|---|
| **orchestrator** | primary | `deepseek/deepseek-v4-pro` | 0.3 | task: allow all | Classifies jobs, delegates to sub-agents, composes outputs |
| **strategist** | subagent | `deepseek/deepseek-v4-pro` | 0.3 | read only | Brand strategy, content planning, audience analysis |
| **producer** | subagent | `deepseek/deepseek-v4-flash` | 0.3 | read, edit | Asset generation (copy, images, layouts) |
| **reviewer** | subagent | `google/gemini-3.5-flash` | 0.4 | read only | Quality gate (brand, SEO, accessibility, grammar) |
| **publisher** | subagent | `deepseek/deepseek-v4-flash` | 0.2 | read, edit, bash:ask | CMS publishing, scheduling, distribution |
| **analyst** | subagent | `deepseek/deepseek-v4-flash` | 0.1 | read only | Performance data, SEO audits, conversion metrics |

---

## 8. Deployment

### Deploying the OpenCode Server on Railway

The OpenCode server runs as a separate Railway service alongside your web app and worker.

#### Dockerfile

```dockerfile
FROM oven/bun:1 AS base

# Install OpenCode globally
RUN bun install -g opencode-ai@latest

# Create config directory and copy files
RUN mkdir -p /root/.config/opencode
COPY config/opencode.json /root/.config/opencode/opencode.json
COPY config/prompts/ /root/.config/opencode/prompts/
COPY skills/ /root/.config/opencode/skills/

# Expose the OpenCode server port
EXPOSE 4096

# Start the headless server
CMD ["opencode", "serve", "--port", "4096", "--hostname", "0.0.0.0"]
```

#### Railway Configuration

```json
{
  "$schema": "https://railway.com/railway.schema.json",
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

#### Internal Networking

Railway services communicate over a private network using `.railway.internal` hostnames. The OpenCode server is reachable at:

```
http://opencode.railway.internal:4096
```

The worker uses this URL when `OPENCODE_SERVER_URL` is not explicitly set in production. In local development with Docker Compose, the service name `opencode` resolves to the container:

```
http://opencode:4096
```

#### Environment Variables (Railway)

Set these in the Railway dashboard for the OpenCode service:

| Variable | Value |
|---|---|
| `OPENROUTER_API_KEY` | `sk-or-v1-...` (your OpenRouter key) |

No other variables are needed for the OpenCode server itself.

#### Deployment Steps

1. **Create a Railway project** (or use an existing one):
   ```bash
   railway init
   ```

2. **Add the OpenCode service** from the Railway dashboard or CLI:
   ```bash
   railway service create opencode
   ```

3. **Set the root directory** to `apps/opencode/` in the Railway service settings.

4. **Add the environment variable:**
   ```bash
   railway env set OPENROUTER_API_KEY=sk-or-v1-your-key-here
   ```

5. **Deploy:**
   ```bash
   railway up
   ```

6. **Verify the server is running:**
   ```bash
   curl http://opencode.railway.internal:4096/health
   ```

### Local Development with Docker Compose

For local development, add the OpenCode service to your `docker-compose.yml`:

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

Then start it alongside your other services:

```bash
docker compose up -d opencode
```

### Template Sync

When you modify the OpenCode server configuration in `packages/opencode/deploy/`, sync the changes to the CLI templates:

```bash
pnpm --filter @techstream/quark-create-app sync-templates
```

This copies `packages/opencode/deploy/` → `packages/cli/templates/opencode/`, ensuring that `quark add ai` scaffolds the latest configuration.

---

## 9. Troubleshooting

### "Model not found" errors

**Symptom:** The OpenCode server returns an error like `Model "openrouter/deepseek/deepseek-v4-flash" not found`.

**Causes and solutions:**

1. **Typo in model name** — Verify the model name matches what OpenRouter expects. Check available models at [openrouter.ai/models](https://openrouter.ai/models).

2. **Provider prefix mismatch** — Ensure the model field uses the correct format: `openrouter/provider/model-name`. For example, `openrouter/deepseek/deepseek-v4-flash` (not `deepseek/deepseek-v4-flash` without the `openrouter/` prefix).

3. **Model deprecated or renamed** — Models are occasionally deprecated by providers. Check the [OpenRouter models page](https://openrouter.ai/models) for the latest names.

### Connection refused (server not running)

**Symptom:** The worker logs `fetch failed: connect ECONNREFUSED http://opencode:4096` or similar.

**Causes and solutions:**

1. **OpenCode server not started** — Ensure the OpenCode service is running:
   ```bash
   # Docker Compose
   docker compose ps opencode
   
   # Railway
   railway service status opencode
   ```

2. **Wrong hostname** — Check the `OPENCODE_SERVER_URL` environment variable:
   - Local Docker: `http://opencode:4096` (Docker Compose service name)
   - Railway: `http://opencode.railway.internal:4096` (internal networking)
   - Custom: Set `OPENCODE_SERVER_URL` explicitly if using a different hostname

3. **Port mismatch** — Verify the OpenCode server is listening on port 4096. Check the Dockerfile and railway.json for the `--port` argument.

### API key not set

**Symptom:** OpenRouter returns 401 Unauthorized or "Invalid API key".

**Causes and solutions:**

1. **Missing environment variable** — Ensure `OPENROUTER_API_KEY` is set in the OpenCode server's environment:
   ```bash
   # Check locally
   echo $OPENROUTER_API_KEY
   
   # Check on Railway
   railway env list
   ```

2. **Invalid API key** — Generate a new key at [openrouter.ai/keys](https://openrouter.ai/keys). Keys start with `sk-or-v1-`.

3. **Key not interpolated** — The `opencode.json` config uses `${OPENROUTER_API_KEY}` syntax. Verify the config file has the correct format:
   ```json
   {
     "provider": {
       "openrouter": {
         "apiKey": "${OPENROUTER_API_KEY}"
       }
     }
   }
   ```

### Session creation failures

**Symptom:** The worker logs `AI session creation failed` or `AI agent task failed`.

**Causes and solutions:**

1. **Server overloaded** — The OpenCode server may be rate-limited. Check server logs:
   ```bash
   # Docker
   docker compose logs opencode
   
   # Railway
   railway logs opencode
   ```

2. **Invalid agent name** — Ensure the agent name in the job data matches an agent defined in `opencode.json`. The default is `"assistant"`.

3. **SDK version mismatch** — Ensure `@opencode-ai/sdk` version in the worker matches the OpenCode server version:
   ```bash
   # Check SDK version
   pnpm ls @opencode-ai/sdk --depth 0
   
   # Check server version
   opencode --version
   ```

### Health check fails

**Symptom:** `handleAiHealthCheck` returns `AI_HEALTH_CHECK_FAILED`.

**Solutions:**

1. Verify the OpenCode server is running and reachable:
   ```bash
   curl http://opencode:4096/health
   ```

2. Check network connectivity between the worker and OpenCode server. On Railway, ensure both services are in the same project (same private network).

3. If using Docker Compose, ensure both services are on the same Docker network.

---

## Development

This package lives inside the Quark monorepo. All development uses `pnpm` — no standalone setup required.

```bash
pnpm install
```

The package is written in ESM JavaScript. No TypeScript, no `require()`.

### Deploying changes locally

```bash
pnpm run deploy
```

This copies configuration, skills, and the plugin entry point to `~/.config/opencode/`.

### Plugin System

The Techstream plugin (`src/index.js`) registers two hooks and two tools:

- **Hooks:**
  - `experimental.session.compacting` — Quality gate refinement loop (max 3 iterations)
  - `experimental.chat.messages.transform` — Output composer (stitches multi-part messages into structured JSON)

- **Tools:**
  - `publish-to-cms` — Zod-validated CMS publishing tool (stub)
  - `check-compliance` — Zod-validated brand compliance checker (stub)

### Skills

Eight skills are available in `packages/opencode/skills/`:

| Skill | Description |
|---|---|
| `accessibility` | WCAG 2.2 compliance (contrast, alt text, keyboard nav, ARIA) |
| `audience-research` | Persona development, demographic analysis, market segmentation |
| `brand-voice` | Client-specific tone, vocabulary, and style guide enforcement |
| `copywriter` | Persuasive copywriting patterns (AIDA, benefit-driven, CTAs) |
| `data-analysis` | Analytics interpretation, trend detection, performance reporting |
| `distribution` | Multi-channel content distribution (email, social, RSS) |
| `seo` | Keyword strategy, metadata optimization, heading hierarchy |
| `skill-builder` | Meta-skill for creating/modifying SKILL.md files |

Skills are auto-discovered from `~/.config/opencode/skills/` and `.opencode/skills/`. No additional configuration is needed — just create a `skills/<name>/SKILL.md` file.
