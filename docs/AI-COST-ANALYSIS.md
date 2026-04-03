# AI Cost Analysis

## Development & Testing Costs

### LLM API Costs During Development

| Provider | Model | Input Tokens | Output Tokens | API Calls | Cost |
|----------|-------|-------------|---------------|-----------|------|
| OpenAI | GPT-4o | ~500K | ~200K | ~200 | ~$4.50 |
| OpenAI | GPT-4o-mini | ~100K | ~50K | ~50 | ~$0.05 |
| OpenAI | Moderation | ~200K | — | ~200 | Free |
| **Total** | | **~800K** | **~250K** | **~450** | **~$4.55** |

### Assumptions
- Average development session: 20 API calls
- Average input: 2,500 tokens (system prompt + tool schemas + conversation history)
- Average output: 1,000 tokens (response + tool calls)
- Moderation calls are free (OpenAI Moderation endpoint)
- No embedding costs (retrieval-based tool injection not yet implemented)

---

## Production Cost Projections

### Key Assumptions
- **Sessions per user per month**: 15 (school days)
- **Messages per session**: 8 (4 user + 4 assistant)
- **Tool invocations per session**: 2
- **Average input tokens per request**: 3,000 (system prompt ~500 + tool schemas ~800 + history ~1,700)
- **Average output tokens per request**: 500
- **Moderation**: 1 call per user message (free)
- **Model**: GPT-4o ($2.50/1M input, $10.00/1M output)

### Cost Breakdown Per Request
- Input: 3,000 tokens × $2.50/1M = $0.0075
- Output: 500 tokens × $10.00/1M = $0.005
- **Total per request: $0.0125**

### Monthly Cost by Scale

| Scale | Users | Sessions/mo | Requests/mo | Input Tokens | Output Tokens | LLM Cost | Infra Cost | **Total** |
|-------|-------|------------|-------------|-------------|---------------|----------|------------|-----------|
| 100 Users | 100 | 1,500 | 12,000 | 36M | 6M | $150 | $25 | **$175/mo** |
| 1,000 Users | 1,000 | 15,000 | 120,000 | 360M | 60M | $1,500 | $75 | **$1,575/mo** |
| 10,000 Users | 10,000 | 150,000 | 1,200,000 | 3.6B | 600M | $15,000 | $300 | **$15,300/mo** |
| 100,000 Users | 100,000 | 1,500,000 | 12,000,000 | 36B | 6B | $150,000 | $2,000 | **$152,000/mo** |

### Infrastructure Cost Breakdown

| Component | 100 Users | 1K Users | 10K Users | 100K Users |
|-----------|-----------|----------|-----------|------------|
| Vercel Pro | $20 | $20 | $20 | $20 |
| PostgreSQL (Neon/Supabase) | Free | $25 | $100 | $500 |
| Redis (Upstash) | Free | $10 | $50 | $200 |
| Bandwidth/CDN | $5 | $20 | $130 | $1,280 |
| **Infra Total** | **$25** | **$75** | **$300** | **$2,000** |

---

## Cost Optimization Strategies

### Immediate (Current Architecture)
1. **Context window management**: Only inject relevant tool schemas (not all apps) — saves ~30% input tokens
2. **Response caching**: Cache common non-personalized responses (weather, factual Q&A) — saves ~15% requests
3. **Model tiering**: Use GPT-4o-mini for simple routing/classification, GPT-4o for complex reasoning — saves ~60% on routing calls

### With Optimization Applied

| Scale | Before | After (est.) | Savings |
|-------|--------|-------------|---------|
| 1,000 Users | $1,575 | ~$900 | 43% |
| 10,000 Users | $15,300 | ~$8,500 | 44% |
| 100,000 Users | $152,000 | ~$82,000 | 46% |

### Future Optimizations
- **Retrieval-based tool injection**: Embed-then-search over plugin registry instead of injecting all schemas
- **Conversation summarization**: Compress old messages to reduce context window growth
- **Streaming response caching**: Cache partial completions for identical tool call patterns
- **Self-hosted models**: Use open-source models (Llama, Mistral) for moderation and simple tasks

---

## Cost Per User Metrics

| Metric | Value |
|--------|-------|
| Cost per user per month (1K users) | $1.58 |
| Cost per user per month (10K users) | $1.53 |
| Cost per session | $0.105 |
| Cost per message | $0.0125 |
| Cost per tool invocation | $0.0125 |
| Marginal cost of adding an app | ~$0 (tool schema adds ~100 tokens) |

---

## Notes
- OpenAI Moderation API is free and does not count toward cost
- Costs assume GPT-4o pricing as of March 2026
- Anthropic Claude pricing is comparable (~$3/1M input, $15/1M output for Sonnet)
- App iframe hosting is negligible (static pages served from same deployment)
- Database costs scale with storage, not compute (conversation history is text-heavy but small)
