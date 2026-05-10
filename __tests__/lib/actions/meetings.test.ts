// __tests__/lib/actions/meetings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockIs = vi.fn().mockResolvedValue({ error: null })
const mockEq: ReturnType<typeof vi.fn> = vi.fn(() => ({ single: mockSingle, is: mockIs, eq: mockEq }))
const mockSelect = vi.fn(() => ({ single: mockSingle, eq: mockEq }))
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockInsertSelect = vi.fn(() => ({ single: mockSingle }))
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }))

const mockFromImpl = vi.fn((table: string) => {
  if (table === 'meetings') return { insert: mockInsert, update: mockUpdate, select: mockSelect }
  if (table === 'show_members') return { select: mockSelect }
  if (table === 'notes') return { insert: mockInsert, update: mockUpdate }
  return {}
})

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const TEST_MEETING_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const TEST_SHOW_ID = 'b1ccdc00-1d2c-5f09-8c7e-7cc0ce491b22'

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    from: mockFromImpl,
    auth: { getUser: mockGetUser },
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('createMeeting', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
    // show_members returns can_manage_show permission
    mockSingle
      .mockResolvedValueOnce({ data: { role_definitions: { permissions: ['can_manage_show'] } }, error: null })
      .mockResolvedValueOnce({ data: { id: TEST_MEETING_ID }, error: null })
  })

  it('inserts meeting and returns id', async () => {
    const { createMeeting } = await import('@/lib/actions/meetings')
    const result = await createMeeting(TEST_SHOW_ID, 'Weekly Design', '2026-06-01T18:00:00.000Z')
    expect(result).toEqual({ id: TEST_MEETING_ID })
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      show_id: TEST_SHOW_ID,
      title: 'Weekly Design',
      created_by: TEST_USER_ID,
    }))
  })

  it('throws Forbidden when user lacks can_manage_show', async () => {
    vi.resetModules()
    vi.clearAllMocks()
    mockSingle.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
    mockSingle.mockResolvedValueOnce({ data: { role_definitions: { permissions: [] } }, error: null })
    const { createMeeting } = await import('@/lib/actions/meetings')
    await expect(createMeeting(TEST_SHOW_ID, 'Title', '2026-06-01T18:00:00.000Z')).rejects.toThrow('Forbidden')
  })

  it('throws Unauthorized when not logged in', async () => {
    vi.resetModules()
    vi.clearAllMocks()
    mockSingle.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { createMeeting } = await import('@/lib/actions/meetings')
    await expect(createMeeting(TEST_SHOW_ID, 'Title', '2026-06-01T18:00:00.000Z')).rejects.toThrow('Unauthorized')
  })
})

describe('startMeeting', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
    mockIs.mockResolvedValue({ error: null })
  })

  it('updates started_at only when currently null', async () => {
    const { startMeeting } = await import('@/lib/actions/meetings')
    await startMeeting(TEST_MEETING_ID)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ started_at: expect.any(String) }))
    expect(mockIs).toHaveBeenCalledWith('started_at', null)
  })
})

describe('addMeetingNote', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockSingle.mockReset()
    mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
    mockSingle.mockResolvedValue({ data: { id: 'note-1' }, error: null })
  })

  it('inserts note with meeting_id', async () => {
    const { addMeetingNote } = await import('@/lib/actions/meetings')
    const result = await addMeetingNote(TEST_MEETING_ID, 'Agreed on dark palette.')
    expect(result).toEqual({ id: 'note-1' })
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      meeting_id: TEST_MEETING_ID,
      body: 'Agreed on dark palette.',
      created_by: TEST_USER_ID,
    }))
  })
})
