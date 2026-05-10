import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ShowDetail } from '@/lib/data/shows'
import type { Department } from '@/lib/types/domain'
import type { MaterialWithUrl } from '@/lib/data/materials'

const org = {
  id: 'org-1', name: 'State U Theater', slug: 'state-u-theater',
  settings: { claudeEnabled: false }, createdAt: '2026-01-01',
}

const mockShow: ShowDetail = {
  id: 'show-1', name: 'Hamlet', slug: 'hamlet', orgId: 'org-1',
  seasonId: null, approvalMode: 'single', allowReopen: false,
  createdAt: '2026-01-01', season: null,
  departments: [{ id: 'dept-1', name: 'Lighting Design', slug: 'lighting-design', created_at: '2026-01-01' }],
  show_members: [],
}

const mockDept: Department = {
  id: 'dept-1', showId: 'show-1', name: 'Lighting Design', slug: 'lighting-design',
  createdAt: '2026-01-01',
}

const mockMaterials: MaterialWithUrl[] = []

vi.mock('@/lib/data/orgs', () => ({ getOrgBySlug: vi.fn().mockResolvedValue(org) }))
vi.mock('@/lib/data/shows', () => ({ getShowBySlug: vi.fn().mockResolvedValue(mockShow) }))
vi.mock('@/lib/data/departments', () => ({ getDepartmentBySlug: vi.fn().mockResolvedValue(mockDept) }))
vi.mock('@/lib/data/materials', () => ({ getMaterialsByDepartment: vi.fn().mockResolvedValue(mockMaterials) }))
vi.mock('@/lib/data/notes', () => ({ getNotesByMaterial: vi.fn().mockResolvedValue([]) }))
vi.mock(
  '@/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/DepartmentClient',
  () => ({ DepartmentClient: () => <div data-testid="dept-client" /> })
)

describe('DepartmentPage', () => {
  it('renders department name in heading', async () => {
    const { default: DepartmentPage } = await import(
      '@/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page'
    )
    const jsx = await DepartmentPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet', deptSlug: 'lighting-design' }),
    })
    render(jsx)
    expect(screen.getByRole('heading', { level: 1, name: 'Lighting Design' })).toBeInTheDocument()
  })

  it('renders breadcrumb with show link', async () => {
    const { default: DepartmentPage } = await import(
      '@/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page'
    )
    const jsx = await DepartmentPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet', deptSlug: 'lighting-design' }),
    })
    render(jsx)
    expect(screen.getByRole('link', { name: 'Hamlet' })).toHaveAttribute(
      'href', '/state-u-theater/shows/hamlet'
    )
  })

  it('renders DepartmentClient', async () => {
    const { default: DepartmentPage } = await import(
      '@/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page'
    )
    const jsx = await DepartmentPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet', deptSlug: 'lighting-design' }),
    })
    render(jsx)
    expect(screen.getByTestId('dept-client')).toBeInTheDocument()
  })

  it('calls notFound when dept missing', async () => {
    const { getDepartmentBySlug } = await import('@/lib/data/departments')
    vi.mocked(getDepartmentBySlug).mockResolvedValueOnce(null)
    const { default: DepartmentPage } = await import(
      '@/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page'
    )
    await expect(
      DepartmentPage({ params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet', deptSlug: 'missing' }) })
    ).rejects.toThrow()
  })
})
