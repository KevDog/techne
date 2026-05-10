import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockNoteRow = {
  id: 'note-1',
  body: 'Consider a darker burgundy.',
  tags: ['color', 'act-2'],
  created_by: 'user-1',
  updated_by: 'user-1',
  created_at: '2026-05-09T10:00:00Z',
  updated_at: '2026-05-09T10:00:00Z',
  hidden_at: null,
  material_id: 'mat-1',
  show_id: null,
  meeting_id: null,
}

const mockIn = vi.fn()
const mockOrder = vi.fn()
const mockEq = vi.fn(() => ({ order: mockOrder }))
const mockSelect = vi.fn(() => ({ eq: mockEq, in: mockIn }))
const mockFrom = vi.fn((table: string) => {
  if (table === 'notes') return { select: mockSelect }
  if (table === 'profiles') return { select: vi.fn(() => ({ in: mockIn })) }
  return {}
})

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}))

describe('getNotesByMaterial', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notes') return { select: mockSelect }
      if (table === 'profiles') return { select: vi.fn(() => ({ in: mockIn })) }
      return {}
    })
  })

  it('returns empty array when query errors', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'fail' } })
    const { getNotesByMaterial } = await import('@/lib/data/notes')
    const result = await getNotesByMaterial('mat-1')
    expect(result).toEqual([])
  })

  it('returns empty array when no notes', async () => {
    mockOrder.mockResolvedValue({ data: [], error: null })
    const { getNotesByMaterial } = await import('@/lib/data/notes')
    const result = await getNotesByMaterial('mat-1')
    expect(result).toEqual([])
  })

  it('maps rows to NoteWithAuthors with display names', async () => {
    mockOrder.mockResolvedValue({ data: [mockNoteRow], error: null })
    mockIn.mockResolvedValue({ data: [{ id: 'user-1', display_name: 'Sarah M' }], error: null })
    const { getNotesByMaterial } = await import('@/lib/data/notes')
    const result = await getNotesByMaterial('mat-1')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      id: 'note-1',
      body: 'Consider a darker burgundy.',
      tags: ['color', 'act-2'],
      createdBy: 'user-1',
      hiddenAt: null,
      materialId: 'mat-1',
      createdByName: 'Sarah M',
      updatedByName: 'Sarah M',
    })
  })

  it('includes hidden notes in result', async () => {
    const hidden = { ...mockNoteRow, hidden_at: '2026-05-09T12:00:00Z' }
    mockOrder.mockResolvedValue({ data: [hidden], error: null })
    mockIn.mockResolvedValue({ data: [{ id: 'user-1', display_name: 'Sarah M' }], error: null })
    const { getNotesByMaterial } = await import('@/lib/data/notes')
    const result = await getNotesByMaterial('mat-1')
    expect(result[0].hiddenAt).toBe('2026-05-09T12:00:00Z')
  })

  it('falls back to Unknown for missing profile', async () => {
    mockOrder.mockResolvedValue({ data: [mockNoteRow], error: null })
    mockIn.mockResolvedValue({ data: [], error: null })
    const { getNotesByMaterial } = await import('@/lib/data/notes')
    const result = await getNotesByMaterial('mat-1')
    expect(result[0].createdByName).toBe('Unknown')
  })
})

describe('getNotesByShow', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    const showNoteRow = { ...mockNoteRow, material_id: null, show_id: 'show-1' }
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notes') return { select: mockSelect }
      if (table === 'profiles') return { select: vi.fn(() => ({ in: mockIn })) }
      return {}
    })
    mockOrder.mockResolvedValue({ data: [showNoteRow], error: null })
    mockIn.mockResolvedValue({ data: [{ id: 'user-1', display_name: 'Tom K' }], error: null })
  })

  it('filters by show_id', async () => {
    const { getNotesByShow } = await import('@/lib/data/notes')
    const result = await getNotesByShow('show-1')
    expect(result[0].showId).toBe('show-1')
    expect(mockEq).toHaveBeenCalledWith('show_id', 'show-1')
  })
})
