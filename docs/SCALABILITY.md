# Scalability: 200K Students and Third-Party App Wait Times

## The Problem

The orchestrator is a single chokepoint. Every tool call flows through it: policy check, moderation, capability token, audit. When 1,000 students come back from recess and open chess games simultaneously, the orchestrator must handle the burst without degrading.

The harder problem: third-party apps take unknown time to respond. A well-behaved chess app completes in minutes. A misbehaving or slow external app could hang indefinitely. The orchestrator can't tie up server resources waiting.

## Current Architecture

```
Request → Rate Limiter → Policy Check → Moderation (external API) → Capability Token → Audit (DB) → Response
```

The bottlenecks, in order of severity:

1. **Moderation API** — external call to OpenAI, ~200ms p50 but can spike to 2-5s
2. **Database writes** — audit logging, session creation
3. **LLM streaming** — the chat endpoint holds a connection for 5-30s per response

## What We've Built

- **Circuit breaker** on the moderation API — after 5 failures in 60s, the circuit opens and returns a fallback for 30s instead of hanging. This prevents a cascade failure where one slow external service takes down the entire platform.
- **Rate limiting** per-user (30 req/min for chat, 60 req/min for tools) — prevents any single user from consuming disproportionate resources.
- **Fire-and-forget audit** — audit writes are non-blocking (`db.insert().then()`) so they never slow down the response path.

## What We'd Add for 200K Users

### 1. Async App Sessions with Webhooks

Current: the orchestrator waits synchronously for the app iframe to signal `APP_READY`.

Better: decouple the orchestrator from app lifecycle entirely.

```
Orchestrator creates session → returns immediately with sessionId
App loads asynchronously → signals APP_READY when ready
If app doesn't signal within 15s → timeout with user-visible error
```

This is already partially implemented (the AppRuntime has a 15s timeout), but the key insight is: **the orchestrator should never block on a third-party app**. The capability token is issued before the app loads. If the app never loads, the token expires (15min TTL) and the session is cleaned up.

### 2. Connection Pooling and Queue-Based Moderation

At 200K DAU with ~10 messages/user/day, that's 2M moderation calls/day or ~23 req/s sustained, with spikes of 10-50x during class transitions.

**Solution:** Replace synchronous moderation with a queue.

```
Request → Quick K-12 regex check (sync, <1ms)
       → If passes: queue for async moderation (non-blocking)
       → LLM response streams immediately
       → If moderation flags it after-the-fact: log + alert teacher
```

The K-12 regex check catches the obvious cases (profanity, personal info, self-harm keywords) synchronously. The heavier OpenAI moderation runs asynchronously and flags for review. This trades a small safety window (seconds) for 10x throughput.

### 3. Redis for Shared State

Current: rate limits and policy are in-memory (lost on restart, not shared across instances).

Production: move to Redis.

```
Rate limiting → Redis INCR with TTL (already have @upstash/ratelimit in deps)
Policy cache  → Redis hash per class, invalidated on teacher update
Session store → Redis for capability token validation across instances
```

This allows horizontal scaling — multiple server instances behind a load balancer, all sharing state through Redis.

### 4. App Sandboxing at Scale

At scale, the concern shifts from "will the app work?" to "will the app take down other users?"

**Per-app resource budgets:**
- Max 5 concurrent sessions per app per class
- Max postMessage rate: 20/s (already implemented in AppRuntime)
- Max session duration: configurable by teacher (15min/30min/1hr)
- If an app consistently times out, auto-disable it and notify the teacher

### 5. LLM Cost at Scale

At 200K users × 10 messages/day × ~500 tokens/message:
- Input: ~1B tokens/day
- At GPT-4o pricing ($2.50/1M input): ~$2,500/day = $75K/month

**Mitigation:**
- Use GPT-4o-mini for move-by-move commentary ($0.15/1M) — 16x cheaper
- Reserve GPT-4o for help requests and game reviews where quality matters
- Cache common responses (opening move commentary, standard teaching patterns)
- Set per-student token budgets with teacher controls

## Summary

The architecture already handles the orchestrator-as-chokepoint concern through circuit breaking and non-blocking audit. The path to 200K users requires: async moderation queue, Redis for shared state, per-app resource budgets, and tiered LLM models. None of these require architectural changes — they're configuration and infrastructure, not redesigns.
