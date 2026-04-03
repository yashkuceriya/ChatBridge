# Case Study Analysis

TutorMeAI is a small education technology company serving two hundred thousand students every day across ten thousand school districts. Their tutoring platform lets students chat with an AI tutor, and teachers want to bring in outside learning tools — chess puzzles, flashcard decks, physics simulations — directly inside that conversation. The core challenge is deceptively simple to state and genuinely hard to solve: how do you let untrusted, third-party software run inside a chat session used by children?

The first problem is trust. Every outside application is, by definition, code that TutorMeAI did not write. A flashcard app built by an independent developer could, if given the chance, read a student's name, school, or conversation history. A poorly coded physics simulation could crash the chat or display inappropriate content. The platform must assume that any third-party app might misbehave, whether through malice or simple negligence, and must contain the blast radius before it reaches a child.

The second problem is control. Teachers and district administrators need the ability to decide which apps appear in which classrooms. A chess app might be welcome in an enrichment session but distracting during a math lesson. The platform cannot leave these decisions to the AI model or to students. Adults in the room must have a clear, understandable way to allow or block every app, and the default must be "blocked until a teacher says otherwise."

The third problem is privacy. Federal law — specifically COPPA for children under thirteen and FERPA for student education records — demands strict data handling. The platform must collect the minimum amount of personal information possible, never share identifying details with outside apps, and keep detailed records of every interaction so that schools can audit what happened and when.

Solving these problems required choosing between several competing approaches. We considered letting the browser manage everything, but that would scatter safety decisions across the user's device where they cannot be enforced reliably. Instead, we chose a central server-side coordinator that acts as the single policy authority: every request from an app or the AI model passes through it, and it enforces the rules before anything reaches the student. For displaying apps, we chose isolated browser frames with strict cross-origin boundaries rather than embedding app code directly into the page, because isolation means a misbehaving app physically cannot access the student's session data. For the AI interaction model, we chose a structured approach where the model can suggest using an app, but the platform itself validates and executes that suggestion — the model never directly controls what runs.

On the ethical side, we made several deliberate choices. Apps are denied by default; a teacher must explicitly enable each one. Student names, emails, and school identifiers are never sent to app frames. Every action — every message, every app launch, every tool call — is recorded in an append-only log that schools can review for compliance. All student input and AI output pass through content moderation filters appropriate for a K-12 audience.

What we landed on is a system where safety is not a feature bolted on at the end but the organizing principle of the architecture. The server coordinator is the single throat to choke for policy. The isolated frames keep untrusted code in a box. The structured tool protocol keeps the AI model on a leash. And the audit log keeps everyone accountable. Every technical decision traces back to one question: does this keep children safe while still letting teachers bring great learning tools into the conversation?

---

# Architecture Overview

## System Diagram

The ChatBridge architecture is organized into three distinct layers, connected by two communication planes. At the top sits the **Client Layer** (Next.js/React), which renders the chat interface and hosts sandboxed iframes for third-party apps. In the middle sits the **Orchestration Layer** (Node.js/TypeScript), which is the policy authority — it manages sessions, enforces permissions, brokers tool calls, moderates content, and maintains the audit log. At the bottom sits the **Data Layer**, comprising PostgreSQL for persistent storage (conversations, app registry, user profiles, audit events) and Redis for ephemeral state (session tokens, rate-limit counters, capability tokens).

```
┌─────────────────────────────────────────────────────┐
│                   Client Layer                       │
│  ┌──────────────┐   ┌────────┐   ┌────────────────┐│
│  │  Chat UI      │   │Toolbar │   │ App Iframes    ││
│  │  (React)      │   │        │   │ (sandboxed,    ││
│  │               │   │        │   │  cross-origin) ││
│  └──────┬───────┘   └───┬────┘   └───────┬────────┘│
│         │                │                │          │
│         │  SSE (streaming)  REST          │postMessage│
└─────────┼────────────────┼────────────────┼──────────┘
          │                │                │
┌─────────┼────────────────┼────────────────┼──────────┐
│         ▼                ▼                ▼          │
│              Orchestration Layer                      │
│  ┌──────────────────────────────────────────────────┐│
│  │  Session Manager │ Policy Engine │ Tool Router   ││
│  │  Content Moderator │ Auth Broker │ Audit Writer  ││
│  └──────────────────────────────────────────────────┘│
│         │                │                │          │
└─────────┼────────────────┼────────────────┼──────────┘
          │                │                │
┌─────────┼────────────────┼────────────────┼──────────┐
│         ▼                ▼                ▼          │
│                    Data Layer                         │
│       ┌────────────────┐    ┌──────────────┐         │
│       │  PostgreSQL     │    │  Redis        │        │
│       │  - conversations│    │  - sessions   │        │
│       │  - app registry │    │  - rate limits│        │
│       │  - audit log    │    │  - cap tokens │        │
│       └────────────────┘    └──────────────┘         │
└──────────────────────────────────────────────────────┘
```

## Three-Layer Architecture

**Client Layer.** The Next.js/React frontend renders the conversational UI and manages the iframe lifecycle. Each third-party app runs inside a `<iframe sandbox="allow-scripts" crossorigin>` element with a unique origin. The client never makes policy decisions — it renders what the orchestrator tells it to render.

**Orchestration Layer.** This is the brain of the system. It receives every inbound request (user messages, tool-call proposals from the LLM, state updates from iframes) and applies policy before forwarding anything. Key subsystems include:

- **Session Manager** — creates and tracks chat sessions, binds capability tokens to sessions.
- **Policy Engine** — checks teacher-configured allow-lists before launching any app.
- **Tool Router** — matches LLM tool-call proposals to registered app tools, validates arguments against JSON schemas, and dispatches invocations.
- **Content Moderator** — filters student input and AI output for K-12 appropriateness.
- **Auth Broker** — holds OAuth tokens server-side, issues scoped capability tokens to iframes, handles Authorization Code + PKCE flows for authenticated apps.
- **Audit Writer** — appends every significant event to the event-sourced audit log (FERPA compliance).

**Data Layer.** PostgreSQL stores durable state: conversation histories, the app registry (manifests, review status), user/role associations, and the append-only audit event log. Redis handles ephemeral, high-frequency data: session tokens, per-user rate-limit counters, and short-lived capability tokens issued to iframes.

## Communication Model — Two Planes

Communication is split into two independent planes:

1. **Platform Plane** (Client <-> Orchestrator): User messages flow over REST. LLM responses stream back via Server-Sent Events (SSE). SSE was chosen over WebSockets because it is simpler, works through more proxies, and the communication pattern is inherently unidirectional (server to client streaming). REST handles all client-initiated actions (send message, launch app, configure settings).

2. **App Plane** (Client <-> Iframe): The chat UI communicates with embedded app iframes exclusively through the `window.postMessage` API. Every message is validated against a defined schema and checked for origin. The protocol follows a strict lifecycle: `SESSION_INIT` (platform sends context to app) -> `APP_READY` (app confirms initialization) -> `TOOL_INVOKE` / `APP_STATE_UPDATE` (bidirectional during session) -> `APP_COMPLETE` or `APP_ERROR` (app signals termination) -> `SESSION_END` (platform tears down). Completion signaling (`APP_COMPLETE`) is critical — it tells the orchestrator the app has finished so it can return control to the conversation.

## Security Model

Security is enforced at multiple levels:

- **Default-deny app activation.** No app runs unless a teacher has explicitly enabled it for that classroom or session.
- **Cross-origin iframe sandboxing.** Each app frame runs on a separate origin with the `sandbox` attribute restricting access to the parent page's DOM, cookies, and storage.
- **Capability tokens.** Iframes receive short-lived, scoped tokens rather than user credentials. Tokens are bound to a specific session and app, stored in Redis, and expire automatically.
- **Server-side token custody.** OAuth access and refresh tokens for authenticated third-party apps are never exposed to the browser. The orchestrator proxies authenticated requests on behalf of the app.
- **PII exclusion.** The `SESSION_INIT` message sent to iframes contains only a session ID, app configuration, and sanitized context — never student names, emails, or school identifiers.
- **Content moderation.** Both student input and AI-generated output pass through moderation filters before reaching the chat or any app.
- **Rate limiting.** Redis-backed per-user and per-app rate limits prevent abuse.

## Plugin Contract

Every third-party app registers via a **manifest** that declares:

| Field | Purpose |
|---|---|
| `app_id` | Unique identifier |
| `name`, `version` | Display metadata |
| `ui.entrypoint_url` | URL loaded into the iframe |
| `tools[]` | Array of tool definitions (name, description, JSON Schema for parameters) |
| `permissions` | Requested capabilities (e.g., `read_context`, `write_state`) |
| `auth` | Auth type: `none` (internal), `api_key` (external public), or `oauth2` (external authenticated) |
| `review_status` | Approval state (`pending`, `approved`, `rejected`) |

The orchestrator validates manifests at registration time and only serves apps with `approved` review status to production sessions.

## Tech Stack Summary

| Layer | Technology | Role |
|---|---|---|
| Frontend | Next.js 14, React 18, TypeScript | Chat UI, iframe host, SSE consumer |
| Backend | Node.js, TypeScript, Express | Orchestrator, API routes, policy engine |
| Database | PostgreSQL | Conversations, registry, audit log |
| Cache | Redis | Sessions, rate limits, capability tokens |
| LLM | OpenAI / Anthropic (provider abstraction) | Structured tool calling, chat completions |
| Deployment | Vercel (frontend), Railway/Fly.io (backend) | Hosting |
