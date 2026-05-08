import { describe, it, expect, vi } from 'vitest'

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: vi.fn() } })),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}))

describe('createSupabaseServerClient', () => {
  it('returns a client with auth methods', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')
    const client = await createSupabaseServerClient()
    expect(client.auth).toBeDefined()
    expect(client.auth.getUser).toBeDefined()
  })
})
