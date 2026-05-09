import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Department } from '@/lib/types/domain'

const mockDept: Department = {
  id: 'dept-1',
  showId: 'show-1',
  name: 'Lighting Design',
  slug: 'lighting-design',
  createdAt: '2026-01-01',
}

const mockImageRow = {
  id: 'm-1',
  department_id: 'dept-1',
  uploaded_by: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Final Plot',
  description: null,
  url: null,
  storage_path: 'org-1/show-1/dept-1/uuid/plot.jpg',
  body: null,
  tags: ['act-1'],
  created_at: '2026-05-09',
}

const mockNoteRow = {
  id: 'm-2',
  department_id: 'dept-1',
  uploaded_by: 'user-1',
  type: 'note',
  state: 'proposed',
  title: 'Concept note',
  description: null,
  url: null,
  storage_path: null,
  body: 'Warmth vs cold',
  tags: [],
  created_at: '2026-05-09',
}

const mockCreateSignedUrl = vi.fn()
const mockStorage = { from: vi.fn(() => ({ createSignedUrl: mockCreateSignedUrl })) }
const mockOrder = vi.fn()
const mockEq = vi.fn(() => ({ order: mockOrder }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))
const mockSupabase = { from: mockFrom, storage: mockStorage }

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue(mockSupabase),
}))

describe('getMaterialsByDepartment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty array on error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'fail' } })
    const { getMaterialsByDepartment } = await import('@/lib/data/materials')
    const result = await getMaterialsByDepartment(mockDept)
    expect(result).toEqual([])
  })

  it('generates signed URL for image type', async () => {
    mockOrder.mockResolvedValue({ data: [mockImageRow], error: null })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
    })
    const { getMaterialsByDepartment } = await import('@/lib/data/materials')
    const result = await getMaterialsByDepartment(mockDept)
    expect(result[0].signedUrl).toBe('https://example.com/signed')
  })

  it('sets signedUrl to null for note type', async () => {
    mockOrder.mockResolvedValue({ data: [mockNoteRow], error: null })
    const { getMaterialsByDepartment } = await import('@/lib/data/materials')
    const result = await getMaterialsByDepartment(mockDept)
    expect(result[0].signedUrl).toBeNull()
    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
  })

  it('maps row fields to camelCase Material', async () => {
    mockOrder.mockResolvedValue({ data: [mockNoteRow], error: null })
    const { getMaterialsByDepartment } = await import('@/lib/data/materials')
    const result = await getMaterialsByDepartment(mockDept)
    expect(result[0]).toMatchObject({
      id: 'm-2',
      departmentId: 'dept-1',
      uploadedBy: 'user-1',
      type: 'note',
      state: 'proposed',
      title: 'Concept note',
      body: 'Warmth vs cold',
      tags: [],
    })
  })
})
