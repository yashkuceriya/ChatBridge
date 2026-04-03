/**
 * Simple in-memory rate limiter for development.
 * Replace with Redis-backed rate limiter (e.g., @upstash/ratelimit) in production.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 20,
  windowMs: 60_000, // 1 minute
};

export function checkRateLimit(
  key: string,
  config: RateLimitConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  // Clean expired entries periodically
  if (store.size > 1000) {
    for (const [k, v] of store) {
      if (v.resetAt < now) store.delete(k);
    }
  }

  if (!entry || entry.resetAt < now) {
    // New window
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, resetAt: entry.resetAt };
}

// Per-user rate limit for chat API
export const CHAT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60_000,
};

// Per-app rate limit for tool invocations
export const TOOL_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 60_000,
};
