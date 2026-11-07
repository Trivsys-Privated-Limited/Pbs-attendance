import { hmacHex } from "./crypto";
import type { Clock, RateLimitDecision, RateLimitRule, RateLimiter } from "./ports";

/** Brute-force policy. Supabase Auth applies its own limits on top of these. */
export const LOGIN_LIMITS = {
  /** Per Employee ID / admin email. */
  identifier: { maxFailures: 5, windowSeconds: 15 * 60, lockSeconds: 15 * 60 },
  /** Per client IP (only when proxy headers are trusted). */
  ip: { maxFailures: 30, windowSeconds: 15 * 60, lockSeconds: 15 * 60 },
} as const;

export function loginRules(
  secret: string,
  kind: "employee" | "admin",
  identifier: string,
  ipAddress: string | null,
): { identifier: RateLimitRule; all: RateLimitRule[] } {
  const identifierRule: RateLimitRule = {
    key: hmacHex(secret, `login:${kind}:${identifier.trim().toLowerCase()}`),
    ...LOGIN_LIMITS.identifier,
  };
  const all = [identifierRule];
  if (ipAddress) all.push({ key: hmacHex(secret, `login:ip:${ipAddress}`), ...LOGIN_LIMITS.ip });
  return { identifier: identifierRule, all };
}

interface Entry {
  failures: number;
  windowStartedAt: number;
  lockedUntil: number;
}

/**
 * In-process limiter for tests and single-instance local development.
 * Production uses the database-backed limiter so limits hold across instances.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly clock: Pick<Clock, "now">) {}

  check(rules: readonly RateLimitRule[]): Promise<RateLimitDecision> {
    const now = this.clock.now();
    let retryAfterMs = 0;
    for (const rule of rules) {
      const entry = this.entries.get(rule.key);
      if (entry && entry.lockedUntil > now)
        retryAfterMs = Math.max(retryAfterMs, entry.lockedUntil - now);
    }
    return Promise.resolve({
      allowed: retryAfterMs === 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    });
  }

  recordFailure(rules: readonly RateLimitRule[]): Promise<void> {
    const now = this.clock.now();
    for (const rule of rules) {
      const entry = this.entries.get(rule.key);
      const windowExpired = !entry || entry.windowStartedAt < now - rule.windowSeconds * 1000;
      const next: Entry = windowExpired
        ? { failures: 1, windowStartedAt: now, lockedUntil: entry?.lockedUntil ?? 0 }
        : { ...entry, failures: entry.failures + 1 };
      if (next.failures >= rule.maxFailures) {
        next.lockedUntil = now + rule.lockSeconds * 1000;
        next.failures = 0;
        next.windowStartedAt = now;
      }
      this.entries.set(rule.key, next);
    }
    return Promise.resolve();
  }

  reset(rule: RateLimitRule): Promise<void> {
    this.entries.delete(rule.key);
    return Promise.resolve();
  }
}
