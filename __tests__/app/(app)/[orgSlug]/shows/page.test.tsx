import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ShowWithRelations } from '@/lib/data/shows'

const org = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'State U Theater',
  slug: 'state-u-theater',
  settings: { claudeEnabled: false },
  createdAt: '2026-01-01',
}

const mockShows: ShowWithRelations[] = [
  {
    id: '1', name: 'Hamlet', slug: 'hamlet', orgId: org.id,
    seasonId: 'season-1', approvalMode: 'multi', allowReopen: true,
    createdAt: '2026-01-01',
    season: { name: '2025–26 Season', slug: '2025-26' },
    departments: [{ id: 'd1' }, { id: 'd2' }],
    show_members: [
      {
        id: 'm1', featured: true,
        profiles: { display_name: 'Antoni Cimolino' },
        role_definitions: { name: 'Director' },
      },
    ],
  },
  {
    id: '2', name: 'King Lear', slug: 'king-lear', orgId: org.id,
    seasonId: 'season-2', approvalMode: 'multi', allowReopen: false,
    createdAt: '2026-01-02',
    season: { name: '2024–25 Season', slug: '2024-25' },
    departments: [],
    show_members: [],
  },
]

vi.mock('@/lib/data/orgs', () => ({ getOrgBySlug: vi.fn().mockResolvedValue(org) }))
vi.mock('@/lib/data/shows', () => ({ getShowsByOrg: vi.fn().mockResolvedValue(mockShows) }))

describe('ShowsPage', () => {
  it('renders show names', async () => {
    const { default: ShowsPage } = await import('@/app/(app)/[orgSlug]/shows/page')
    const jsx = await ShowsPage({ params: Promise.resolve({ orgSlug: 'state-u-theater' }) })
    render(jsx)
    expect(screen.getByText('Hamlet')).toBeInTheDocument()
    expect(screen.getByText('King Lear')).toBeInTheDocument()
  })

  it('renders season group headings', async () => {
    const { default: ShowsPage } = await import('@/app/(app)/[orgSlug]/shows/page')
    const jsx = await ShowsPage({ params: Promise.resolve({ orgSlug: 'state-u-theater' }) })
    render(jsx)
    expect(screen.getAllByText('2025–26 Season')).toHaveLength(2)
    expect(screen.getAllByText('2024–25 Season')).toHaveLength(2)
  })

  it('renders featured member name in show subtitle', async () => {
    const { default: ShowsPage } = await import('@/app/(app)/[orgSlug]/shows/page')
    const jsx = await ShowsPage({ params: Promise.resolve({ orgSlug: 'state-u-theater' }) })
    render(jsx)
    expect(screen.getByText(/Antoni Cimolino/)).toBeInTheDocument()
  })
})
