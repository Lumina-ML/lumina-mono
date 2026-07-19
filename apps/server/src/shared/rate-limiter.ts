/**
 * A tiny in-memory fixed-window rate limiter.
 *
 * Deliberately dependency-free and process-local: it exists to blunt abuse of
 * a single unauthenticated endpoint (self-service API-key recovery), not to be
 * a distributed quota system. In a multi-instance deployment each instance
 * keeps its own counters — acceptable here because the allowlist is the real
 * security boundary and the limiter is defense-in-depth against brute force.
 *
 * Each key gets a window of `windowMs`; up to `max` hits are allowed within a
 * window before `hit()` starts returning false. The window resets lazily on
 * the first hit after it expires, so there's no background timer to manage.
 */
export interface RateLimiterOptions {
  /** Max allowed hits per window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Injectable clock for deterministic tests. Defaults to Date.now. */
  now?: () => number;
}

interface WindowState {
  count: number;
  /** Epoch ms when the current window expires. */
  resetAt: number;
}

export class FixedWindowRateLimiter {
  private readonly max: number;
  private readonly windowMs: number;
  private readonly now: () => number;
  private readonly windows = new Map<string, WindowState>();

  constructor(options: RateLimiterOptions) {
    this.max = options.max;
    this.windowMs = options.windowMs;
    this.now = options.now ?? Date.now;
  }

  /**
   * Record a hit for `key`. Returns true if the hit is within the allowance,
   * false once the key has exceeded `max` within the current window.
   */
  hit(key: string): boolean {
    const t = this.now();
    const existing = this.windows.get(key);

    if (!existing || t >= existing.resetAt) {
      this.windows.set(key, { count: 1, resetAt: t + this.windowMs });
      return true;
    }

    if (existing.count >= this.max) {
      return false;
    }

    existing.count += 1;
    return true;
  }

  /** Clear a key's window (e.g. on a successful, legitimate action). */
  reset(key: string): void {
    this.windows.delete(key);
  }
}
