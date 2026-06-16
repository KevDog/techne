type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export type RateLimitResult = { ok: true } | { ok: false; retryAfterMs: number }

/**
 * Fixed-window in-memory rate limiter. Suitable for single-instance deploys;
 * for multi-instance fan-out, swap to Redis behind the same surface.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true }
  }
  if (bucket.count < limit) {
    bucket.count += 1
    return { ok: true }
  }
  return { ok: false, retryAfterMs: bucket.resetAt - now }
}

export function _resetForTests(): void {
  buckets.clear()
}
