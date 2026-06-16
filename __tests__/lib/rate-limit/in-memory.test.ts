import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { _resetForTests, rateLimit } from '@/lib/rate-limit/in-memory'

describe('rateLimit', () => {
  beforeEach(() => {
    _resetForTests()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('allows requests up to the limit', () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit('user-1', 3, 1000)).toEqual({ ok: true })
    }
  })

  it('rejects requests over the limit with retryAfterMs', () => {
    rateLimit('user-1', 2, 1000)
    rateLimit('user-1', 2, 1000)
    const result = rateLimit('user-1', 2, 1000)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.retryAfterMs).toBeGreaterThan(0)
  })

  it('separates buckets by key', () => {
    rateLimit('user-1', 1, 1000)
    expect(rateLimit('user-2', 1, 1000)).toEqual({ ok: true })
  })

  it('resets when window expires', () => {
    rateLimit('user-1', 1, 1000)
    vi.advanceTimersByTime(1001)
    expect(rateLimit('user-1', 1, 1000)).toEqual({ ok: true })
  })
})
