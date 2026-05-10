import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockInsertSingle = vi.fn()
const mockInsertSelect = vi.fn(() => ({ single: mockInsertSingle }))
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }))
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }))

const mockFromImpl = vi.fn((table: string) => {
  if (table === 'notes') return { insert: mockInsert, update: mockUpdate }
  return {}
})

const TEST_NOTE_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000'

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    from: mockFromImpl,
    auth: { getUser: mockGetUser },
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('createNote', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
    mockInsertSingle.mockResolvedValue({ data: { id: TEST_NOTE_ID }, error: null })
  })

  it('inserts note attached to material', async () => {
    const { createNote } = await import('@/lib/actions/notes')
    const result = await createNote({ materialId: 'mat-1' }, { body: 'Test note', tags: ['tag1'] })
    expect(result).toEqual({ id: TEST_NOTE_ID })
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Test note',
      tags: ['tag1'],
      material_id: 'mat-1',
      created_by: TEST_USER_ID,
      updated_by: TEST_USER_ID,
    }))
  })

  it('inserts note attached to show', async () => {
    const { createNote } = await import('@/lib/actions/notes')
    await createNote({ showId: 'show-1' }, { body: 'Show note' })
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      show_id: 'show-1',
      created_by: TEST_USER_ID,
    }))
  })

  it('throws Unauthorized when not logged in', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const { createNote } = await import('@/lib/actions/notes')
    await expect(createNote({ materialId: 'mat-1' }, { body: 'note' })).rejects.toThrow('Unauthorized')
  })
})

describe('updateNote', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  it('updates body, tags, updated_by, and updated_at', async () => {
    const { updateNote } = await import('@/lib/actions/notes')
    await updateNote(TEST_NOTE_ID, { body: 'Updated body', tags: ['new-tag'] })
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
      body: 'Updated body',
      tags: ['new-tag'],
      updated_by: TEST_USER_ID,
      updated_at: expect.any(String),
    }))
    expect(mockUpdateEq).toHaveBeenCalledWith('id', TEST_NOTE_ID)
  })

  it('throws Unauthorized when not logged in', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const { updateNote } = await import('@/lib/actions/notes')
    await expect(updateNote(TEST_NOTE_ID, { body: 'x' })).rejects.toThrow('Unauthorized')
  })
})

describe('hideNote', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  it('sets hidden_at to a timestamp', async () => {
    const { hideNote } = await import('@/lib/actions/notes')
    await hideNote(TEST_NOTE_ID)
    expect(mockUpdate).toHaveBeenCalledWith({ hidden_at: expect.any(String) })
  })

  it('does not update updated_by or updated_at', async () => {
    const { hideNote } = await import('@/lib/actions/notes')
    await hideNote(TEST_NOTE_ID)
    const call = (mockUpdate.mock.calls as unknown[][])[0]?.[0] as Record<string, unknown> | undefined
    expect(call).not.toHaveProperty('updated_by')
    expect(call).not.toHaveProperty('updated_at')
  })
})

describe('restoreNote', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
    mockUpdateEq.mockResolvedValue({ error: null })
  })

  it('sets hidden_at to null', async () => {
    const { restoreNote } = await import('@/lib/actions/notes')
    await restoreNote(TEST_NOTE_ID)
    expect(mockUpdate).toHaveBeenCalledWith({ hidden_at: null })
  })
})
