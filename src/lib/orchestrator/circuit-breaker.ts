/**
 * Circuit breaker for the orchestrator pipeline.
 *
 * The orchestrator is a single chokepoint — every tool call flows through it.
 * If moderation APIs, DB, or external services are slow/down, the circuit
 * opens and returns a graceful degradation response instead of hanging.
 *
 * States:
 *   CLOSED  → normal operation, requests pass through
 *   OPEN    → too many failures, reject immediately with fallback
 *   HALF_OPEN → after cooldown, allow one probe request to test recovery
 */

type CircuitState = "closed" | "open" | "half_open";

interface CircuitBreakerConfig {
  failureThreshold: number;   // failures before opening
  resetTimeoutMs: number;     // how long to stay open before half-open
  monitorWindowMs: number;    // sliding window for counting failures
}

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  openedAt: number;
  totalTrips: number;         // how many times the circuit has opened
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeoutMs: 30_000,     // 30s cooldown
  monitorWindowMs: 60_000,    // 1min sliding window
};

// Per-service circuit breakers
const breakers = new Map<string, CircuitBreakerState>();

function getState(service: string): CircuitBreakerState {
  if (!breakers.has(service)) {
    breakers.set(service, {
      state: "closed",
      failures: 0,
      lastFailureAt: 0,
      openedAt: 0,
      totalTrips: 0,
    });
  }
  return breakers.get(service)!;
}

/**
 * Check if a request should be allowed through.
 */
export function canExecute(
  service: string,
  config: CircuitBreakerConfig = DEFAULT_CONFIG
): { allowed: boolean; state: CircuitState; reason?: string } {
  const cb = getState(service);
  const now = Date.now();

  // Reset failure count if outside monitoring window
  if (cb.state === "closed" && cb.lastFailureAt > 0 && now - cb.lastFailureAt > config.monitorWindowMs) {
    cb.failures = 0;
  }

  switch (cb.state) {
    case "closed":
      return { allowed: true, state: "closed" };

    case "open": {
      // Check if cooldown has elapsed → move to half_open
      if (now - cb.openedAt >= config.resetTimeoutMs) {
        cb.state = "half_open";
        return { allowed: true, state: "half_open" };
      }
      const remainingMs = config.resetTimeoutMs - (now - cb.openedAt);
      return {
        allowed: false,
        state: "open",
        reason: `Service "${service}" circuit is open. Retry in ${Math.ceil(remainingMs / 1000)}s.`,
      };
    }

    case "half_open":
      // Allow one probe request
      return { allowed: true, state: "half_open" };

    default:
      return { allowed: true, state: "closed" };
  }
}

/**
 * Record a successful execution — resets the breaker.
 */
export function recordSuccess(service: string): void {
  const cb = getState(service);
  cb.failures = 0;
  cb.state = "closed";
}

/**
 * Record a failure — may trip the breaker.
 */
export function recordFailure(
  service: string,
  config: CircuitBreakerConfig = DEFAULT_CONFIG
): { tripped: boolean } {
  const cb = getState(service);
  cb.failures++;
  cb.lastFailureAt = Date.now();

  if (cb.state === "half_open") {
    // Probe failed — reopen
    cb.state = "open";
    cb.openedAt = Date.now();
    cb.totalTrips++;
    return { tripped: true };
  }

  if (cb.failures >= config.failureThreshold) {
    cb.state = "open";
    cb.openedAt = Date.now();
    cb.totalTrips++;
    console.warn(`[CIRCUIT BREAKER] "${service}" opened after ${cb.failures} failures (trip #${cb.totalTrips})`);
    return { tripped: true };
  }

  return { tripped: false };
}

/**
 * Get circuit breaker status for monitoring/dashboards.
 */
export function getCircuitStatus(service: string): {
  state: CircuitState;
  failures: number;
  totalTrips: number;
} {
  const cb = getState(service);
  return {
    state: cb.state,
    failures: cb.failures,
    totalTrips: cb.totalTrips,
  };
}

/**
 * Wrap an async operation with circuit breaker protection.
 * Returns the result on success, or the fallback on circuit-open/failure.
 */
export async function withCircuitBreaker<T>(
  service: string,
  operation: () => Promise<T>,
  fallback: T,
  config: CircuitBreakerConfig = DEFAULT_CONFIG
): Promise<{ result: T; fromFallback: boolean }> {
  const check = canExecute(service, config);

  if (!check.allowed) {
    return { result: fallback, fromFallback: true };
  }

  try {
    const result = await operation();
    recordSuccess(service);
    return { result, fromFallback: false };
  } catch (err) {
    recordFailure(service, config);
    console.error(`[CIRCUIT BREAKER] "${service}" operation failed:`, err);
    return { result: fallback, fromFallback: true };
  }
}
