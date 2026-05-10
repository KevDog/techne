import { describe, it, expect, vi } from 'vitest'

const mockSingle = vi.fn()
const mockOrder = vi.fn(() => ({ single: mockSingle }))
const mockEq = vi.fn(() => ({ order: mockOrder, single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    from: vi.fn(() => ({ select: mockSelect })),
  }),
}))

const MEETING_ROW = {
  id: 'meet-1',
  show_id: 'show-1',
  title: 'Weekly Design',
  scheduled_at: '2026-06-01T18:00:00Z',
  started_at: null,
  ended_at: null,
  created_by: 'user-1',
  created_at: '2026-05-09T00:00:00Z',
}

describe('getMeetingsByShow', () => {
  it('maps snake_case row to camelCase Meeting', async () => {
    vi.resetModules()
    mockOrder.mockResolvedValueOnce({ data: [MEETING_ROW], error: null })
    const { getMeetingsByShow } = await import('@/lib/data/meetings')
    const result = await getMeetingsByShow('show-1')
    expect(result[0]).toMatchObject({
      id: 'meet-1',
      showId: 'show-1',
      title: 'Weekly Design',
      scheduledAt: '2026-06-01T18:00:00Z',
      startedAt: null,
      endedAt: null,
      createdBy: 'user-1',
    })
  })

  it('returns [] on error', async () => {
    vi.resetModules()
    mockOrder.mockResolvedValueOnce({ data: null, error: new Error('db error') })
    const { getMeetingsByShow } = await import('@/lib/data/meetings')
    expect(await getMeetingsByShow('show-1')).toEqual([])
  })
})

describe('getMeetingById', () => {
  it('returns null on error', async () => {
    vi.resetModules()
    mockSingle.mockResolvedValueOnce({ data: null, error: new Error('not found') })
    const { getMeetingById } = await import('@/lib/data/meetings')
    expect(await getMeetingById('bad-id')).toBeNull()
  })
})

describe('getNotesByMeeting', () => {
  it('returns [] when no notes found', async () => {
    vi.resetModules()
    mockOrder.mockResolvedValueOnce({ data: [], error: null })
    const { getNotesByMeeting } = await import('@/lib/data/notes')
    expect(await getNotesByMeeting('meet-1')).toEqual([])
  })
})
