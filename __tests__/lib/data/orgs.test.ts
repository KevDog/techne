import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({ from: mockFrom })),
}))

describe('getOrgBySlug', () => {
  beforeEach(() => vi.resetModules())

  it('returns org when found', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: '1', name: 'Test Org', slug: 'test-org',
        settings: { claudeEnabled: false }, created_at: '2026-01-01',
      },
      error: null,
    })
    const { getOrgBySlug } = await import('@/lib/data/orgs')
    const result = await getOrgBySlug('test-org')
    expect(result).not.toBeNull()
    expect(result?.slug).toBe('test-org')
  })

  it('returns null when not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const { getOrgBySlug } = await import('@/lib/data/orgs')
    const result = await getOrgBySlug('missing')
    expect(result).toBeNull()
  })
})
