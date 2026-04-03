# ChatBridge

K-12 AI chat platform with third-party app integration.

## Quick Start
```bash
docker compose up -d          # Start Postgres + Redis
cp .env.example .env.local    # Configure API keys
npm install                   # Install deps
npx drizzle-kit push          # Push DB schema
npm run dev -- --port 3001    # Start dev server (port 3000 may be taken)
```

## Architecture
- **Frontend**: Next.js 16 + React + Tailwind + Zustand
- **Backend**: Next.js API routes (orchestrator pattern)
- **LLM**: AI SDK v6 with OpenAI/Anthropic tool calling
- **DB**: PostgreSQL (Drizzle ORM) + Redis
- **Apps**: Chess, Weather, Spotify — rendered as inline panels

## Key Patterns
- AI SDK v6: `useChat` from `@ai-sdk/react`, `DefaultChatTransport`, `convertToModelMessages`, `createUIMessageStreamResponse`
- Tool parts in messages have `type: "tool-{toolName}"` (not `"tool-invocation"`)
- `z.record()` needs key type in Zod v4: `z.record(z.string(), z.unknown())`
- `react-chessboard` v5 uses `options` prop wrapper

## Project Structure
- `src/app/api/chat/` — Chat streaming API with tool calling
- `src/app/api/apps/` — App registration API
- `src/app/apps/` — Standalone app pages (chess, weather, spotify)
- `src/components/apps/` — Inline app panel components
- `src/components/chat/` — Chat UI components
- `src/lib/orchestrator/` — Tool routing, validation, context
- `src/lib/plugins/` — Plugin registry with built-in apps
- `src/lib/db/` — Drizzle schema and connection
- `src/lib/security/` — Capability tokens
- `src/lib/moderation/` — Content moderation for K-12
- `src/store/` — Zustand state management
