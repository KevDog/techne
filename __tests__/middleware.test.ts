import { describe, it, expect, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
  })),
}))

describe('middleware', () => {
  it('redirects unauthenticated requests to /login', async () => {
    const { middleware } = await import('@/middleware')
    const request = new NextRequest('http://localhost:3000/dashboard')
    const response = await middleware(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('allows unauthenticated requests to /login', async () => {
    const { middleware } = await import('@/middleware')
    const request = new NextRequest('http://localhost:3000/login')
    const response = await middleware(request)
    expect(response.status).not.toBe(307)
  })
})
