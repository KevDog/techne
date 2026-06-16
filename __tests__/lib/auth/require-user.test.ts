import { describe, expect, it, vi, beforeEach } from 'vitest'

const { getUserMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: getUserMock },
  }),
}))

import { requireUser } from '@/lib/auth/require-user'

describe('requireUser', () => {
  beforeEach(() => {
    getUserMock.mockReset()
  })

  it('returns supabase + user when authenticated', async () => {
    const user = { id: 'u-1', email: 'a@b.c' }
    getUserMock.mockResolvedValueOnce({ data: { user } })

    const ctx = await requireUser()

    expect(ctx.user).toBe(user)
    expect(ctx.supabase).toBeDefined()
  })

  it('throws Unauthorized when no user', async () => {
    getUserMock.mockResolvedValueOnce({ data: { user: null } })

    await expect(requireUser()).rejects.toThrow('Unauthorized')
  })
})
