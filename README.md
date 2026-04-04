# ChatBridge

K-12 AI tutoring platform that orchestrates third-party apps inside chat. Students learn through interactive games (chess, tic-tac-toe, ludo) with real-time AI tutoring, while teachers control access and all interactions are audited for FERPA compliance.

**Live:** https://chatbridge-production-dd89.up.railway.app

## Architecture

```
Student message
  |
  v
/api/chat (LLM with tool calling)
  |
  v
LLM proposes tool call (e.g. chess_start_game)
  |
  v
/api/orchestrator/invoke
  |- Policy check (default-deny, teacher-controlled)
  |- Rate limiting (per-user, per-app)
  |- Content moderation (OpenAI + K-12 filters)
  |- Circuit breaker (graceful degradation)
  |- Capability token (JWT, 15min expiry)
  |- Audit log (PostgreSQL)
  |
  v
AppRuntime (sandboxed iframe)
  |- postMessage protocol (APP_READY, SESSION_INIT, TOOL_INVOKE)
  |- Runtime monitoring (message validation, rate limiting, violation detection)
  |- State updates flow back to LLM context
  |
  v
AI tutors in real-time (question-first teaching, one concept per move)
```

**Key design decisions:**
- Backend orchestrator (not frontend) for policy enforcement and audit
- Cross-origin sandboxed iframes for app isolation
- Structured tool calling: LLM proposes, orchestrator validates, server executes
- Circuit breaker on external services (moderation API) for availability
- Runtime misbehavior detection: message type validation, rate limiting, violation tracking

## Apps

| App | Auth Type | Description |
|-----|-----------|-------------|
| Chess | Internal (none) | 6 AI opponents, real-time move tutoring, post-game review |
| Tic-Tac-Toe | Internal (none) | 3 difficulty levels, strategy teaching |
| Ludo | Internal (none) | Probability and decision-making |
| Weather | API Key | OpenWeatherMap integration |
| Spotify | OAuth2 | Search with client credentials flow |

## Tech Stack

- **Frontend:** Next.js 16, React, Tailwind CSS, Zustand, Framer Motion
- **Backend:** Next.js API routes (orchestrator pattern)
- **LLM:** AI SDK v6 with OpenAI (streaming, tool calling, multi-step)
- **Database:** PostgreSQL (Drizzle ORM)
- **Auth:** NextAuth.js (JWT sessions)
- **Infra:** Railway (app + Postgres)

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/yashkuceriya/ChatBridge.git
cd ChatBridge
npm install

# 2. Start Postgres + Redis
docker compose up -d

# 3. Configure environment
cp .env.example .env.local
# Fill in OPENAI_API_KEY and generate secrets

# 4. Push database schema
npx drizzle-kit push

# 5. Start dev server
npm run dev -- --port 3001
```

## Environment Variables

```
OPENAI_API_KEY=           # Required — OpenAI API key
DATABASE_URL=             # Required — PostgreSQL connection string
NEXTAUTH_SECRET=          # Required — run: openssl rand -hex 32
NEXTAUTH_URL=             # Required — http://localhost:3001 for dev
CAPABILITY_TOKEN_SECRET=  # Required — run: openssl rand -hex 32

ANTHROPIC_API_KEY=        # Optional — for Anthropic model support
OPENWEATHER_API_KEY=      # Optional — for live weather data
SPOTIFY_CLIENT_ID=        # Optional — for live Spotify search
SPOTIFY_CLIENT_SECRET=    # Optional — for live Spotify search
```

## Project Structure

```
src/
  app/
    api/
      chat/           — LLM streaming endpoint with tool execution
      orchestrator/   — Tool validation, policy, moderation pipeline
      conversations/  — CRUD for chat persistence
      auth/           — NextAuth + Spotify OAuth
      admin/          — Teacher policy management
    apps/
      chess/          — Chess game (iframe app)
      tictactoe/      — Tic-tac-toe game (iframe app)
      ludo/           — Ludo game (iframe app)
      weather/        — Weather dashboard (iframe app)
      spotify/        — Spotify search (iframe app)
  lib/
    orchestrator/     — Core: audit, policy engine, circuit breaker
    plugins/          — App registry and tool definitions
    security/         — Capability tokens, rate limiting
    moderation/       — K-12 content filtering
    db/               — Drizzle schema and connection
    chess-engine.ts   — Minimax AI with alpha-beta pruning
    app-sdk.ts        — PostMessage SDK for iframe apps
  components/
    apps/             — AppRuntime (iframe host with runtime monitoring)
    chat/             — Chat UI (messages, input, suggestions)
    layout/           — Sidebar, user menu
```

## K-12 Safety

- **Pre-LLM moderation:** OpenAI moderation API + custom K-12 filters (personal info, jailbreaks, self-harm with crisis resources, substances, violence)
- **Post-LLM moderation:** Output checked before audit logging
- **Guardrails in system prompt:** Behavioral routing rejects off-topic/unsafe content
- **Default-deny policy:** Teachers must enable each app
- **Audit trail:** Every tool call, moderation flag, and policy decision logged to PostgreSQL
- **Circuit breaker:** If moderation API is down, fails closed in production

## API Documentation

See [docs/API.md](docs/API.md) for endpoint details.
