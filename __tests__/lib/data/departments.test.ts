import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Show } from '@/lib/types/domain'

const mockShow: Show = {
  id: 'show-1', orgId: 'org-1', seasonId: null, name: 'Hamlet', slug: 'hamlet',
  approvalMode: 'single', allowReopen: false, createdAt: '2026-01-01',
}

const mockDeptRow = {
  id: 'dept-1', show_id: 'show-1', name: 'Lighting Design', slug: 'lighting-design',
  created_at: '2026-01-01',
}

const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ eq: mockEq, single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))
const mockSupabase = { from: mockFrom }

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue(mockSupabase),
}))

describe('getDepartmentBySlug', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null when not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const { getDepartmentBySlug } = await import('@/lib/data/departments')
    const result = await getDepartmentBySlug(mockShow, 'missing')
    expect(result).toBeNull()
  })

  it('returns Department when found', async () => {
    mockSingle.mockResolvedValue({ data: mockDeptRow, error: null })
    const { getDepartmentBySlug } = await import('@/lib/data/departments')
    const result = await getDepartmentBySlug(mockShow, 'lighting-design')
    expect(result).toEqual({
      id: 'dept-1',
      showId: 'show-1',
      name: 'Lighting Design',
      slug: 'lighting-design',
      createdAt: '2026-01-01',
    })
  })
})
