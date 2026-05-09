import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ShowDetail } from '@/lib/data/shows'

const org = {
  id: '1', name: 'State U Theater', slug: 'state-u-theater',
  settings: { claudeEnabled: false }, createdAt: '2026-01-01',
}

const mockShow: ShowDetail = {
  id: '1', name: 'Hamlet', slug: 'hamlet', orgId: org.id,
  seasonId: 's1', approvalMode: 'multi', allowReopen: true,
  createdAt: '2026-01-01',
  season: { name: '2025–26 Season', slug: '2025-26' },
  departments: [
    { id: 'd1', name: 'Scenic Design',  slug: 'scenic-design',  created_at: '2026-01-01' },
    { id: 'd2', name: 'Costume Design', slug: 'costume-design', created_at: '2026-01-01' },
  ],
  show_members: [
    {
      id: 'm1', featured: true,
      profiles: { display_name: 'Antoni Cimolino' },
      role_definitions: { name: 'Director' },
    },
    {
      id: 'm2', featured: false,
      profiles: { display_name: 'Jane Smith' },
      role_definitions: { name: 'Set Designer' },
    },
  ],
}

vi.mock('@/lib/data/orgs', () => ({ getOrgBySlug: vi.fn().mockResolvedValue(org) }))
vi.mock('@/lib/data/shows', () => ({ getShowBySlug: vi.fn().mockResolvedValue(mockShow) }))

describe('ShowDetailPage', () => {
  it('renders show name', async () => {
    const { default: ShowDetailPage } = await import('@/app/(app)/[orgSlug]/shows/[showSlug]/page')
    const jsx = await ShowDetailPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet' }),
    })
    render(jsx)
    expect(screen.getByRole('heading', { level: 1, name: 'Hamlet' })).toBeInTheDocument()
  })

  it('renders department names', async () => {
    const { default: ShowDetailPage } = await import('@/app/(app)/[orgSlug]/shows/[showSlug]/page')
    const jsx = await ShowDetailPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet' }),
    })
    render(jsx)
    expect(screen.getByText('Scenic Design')).toBeInTheDocument()
    expect(screen.getByText('Costume Design')).toBeInTheDocument()
  })

  it('renders member names and roles', async () => {
    const { default: ShowDetailPage } = await import('@/app/(app)/[orgSlug]/shows/[showSlug]/page')
    const jsx = await ShowDetailPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet' }),
    })
    render(jsx)
    expect(screen.getByText('Antoni Cimolino')).toBeInTheDocument()
    expect(screen.getByText('Director')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('renders department links', async () => {
    const { default: ShowDetailPage } = await import('@/app/(app)/[orgSlug]/shows/[showSlug]/page')
    const jsx = await ShowDetailPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet' }),
    })
    render(jsx)
    const link = screen.getByRole('link', { name: 'Scenic Design' })
    expect(link).toHaveAttribute('href', '/state-u-theater/shows/hamlet/departments/scenic-design')
  })
})
