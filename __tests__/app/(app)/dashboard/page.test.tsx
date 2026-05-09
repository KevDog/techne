import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Org } from '@/lib/types/domain'

const mockOrgs: Org[] = [
  { id: '1', name: 'State University Theater', slug: 'state-u-theater', createdAt: '2026-01-01', settings: { claudeEnabled: false } },
  { id: '2', name: 'Riverside Regional', slug: 'riverside-regional', createdAt: '2026-01-01', settings: { claudeEnabled: false } },
]

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: mockOrgs, error: null }),
    })),
  })),
}))

describe('DashboardPage', () => {
  it('renders a list of org names', async () => {
    const { default: DashboardPage } = await import('@/app/(app)/dashboard/page')
    const jsx = await DashboardPage()
    render(jsx)
    expect(screen.getByText('State University Theater')).toBeInTheDocument()
    expect(screen.getByText('Riverside Regional')).toBeInTheDocument()
  })

  it('links each org to its shows page', async () => {
    const { default: DashboardPage } = await import('@/app/(app)/dashboard/page')
    const jsx = await DashboardPage()
    render(jsx)
    const link = screen.getByRole('link', { name: 'State University Theater' })
    expect(link).toHaveAttribute('href', '/state-u-theater/shows')
  })
})
