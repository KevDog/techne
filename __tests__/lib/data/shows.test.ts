import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockEqSlug = vi.fn(() => ({ single: mockSingle }))
const mockEqOrg = vi.fn(() => ({
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  eq: mockEqSlug,
}))
const mockSelect = vi.fn(() => ({ eq: mockEqOrg }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({ from: mockFrom })),
}))

const org = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'State U Theater',
  slug: 'state-u-theater',
  settings: { claudeEnabled: false },
  createdAt: '2026-01-01',
}

describe('getShowsByOrg', () => {
  beforeEach(() => vi.resetModules())

  it('returns empty array when org has no shows', async () => {
    const { getShowsByOrg } = await import('@/lib/data/shows')
    const result = await getShowsByOrg(org)
    expect(result).toEqual([])
  })
})

describe('getShowBySlug', () => {
  beforeEach(() => vi.resetModules())

  it('returns null when show not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const { getShowBySlug } = await import('@/lib/data/shows')
    const result = await getShowBySlug(org, 'missing')
    expect(result).toBeNull()
  })
})
