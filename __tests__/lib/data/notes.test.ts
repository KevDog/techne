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
    expect(result[0]!.hiddenAt).toBe('2026-05-09T12:00:00Z')
  })

  it('falls back to Unknown for missing profile', async () => {
    mockOrder.mockResolvedValue({ data: [mockNoteRow], error: null })
    mockIn.mockResolvedValue({ data: [], error: null })
    const { getNotesByMaterial } = await import('@/lib/data/notes')
    const result = await getNotesByMaterial('mat-1')
    expect(result[0]!.createdByName).toBe('Unknown')
  })
})

describe('getNotesByMaterialIds', () => {
  const notesIn = vi.fn()
  const notesOrder = vi.fn()
  const profilesIn = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    notesIn.mockReturnValue({ order: notesOrder })
    mockFrom.mockImplementation((table: string) => {
      if (table === 'notes') return { select: vi.fn(() => ({ in: notesIn })) }
      if (table === 'profiles') return { select: vi.fn(() => ({ in: profilesIn })) }
      return {}
    })
  })

  it('returns empty object when no ids passed', async () => {
    const { getNotesByMaterialIds } = await import('@/lib/data/notes')
    const result = await getNotesByMaterialIds([])
    expect(result).toEqual({})
    expect(notesIn).not.toHaveBeenCalled()
  })

  it('issues a single notes query for all ids', async () => {
    notesOrder.mockResolvedValue({ data: [], error: null })
    const { getNotesByMaterialIds } = await import('@/lib/data/notes')
    await getNotesByMaterialIds(['mat-1', 'mat-2', 'mat-3'])
    expect(notesIn).toHaveBeenCalledTimes(1)
    expect(notesIn).toHaveBeenCalledWith('material_id', ['mat-1', 'mat-2', 'mat-3'])
  })

  it('groups notes by material_id and includes empty buckets', async () => {
    const noteA = { ...mockNoteRow, id: 'n-a', material_id: 'mat-1' }
    const noteB = { ...mockNoteRow, id: 'n-b', material_id: 'mat-2' }
    const noteC = { ...mockNoteRow, id: 'n-c', material_id: 'mat-1' }
    notesOrder.mockResolvedValue({ data: [noteA, noteC, noteB], error: null })
    profilesIn.mockResolvedValue({
      data: [{ id: 'user-1', display_name: 'Sarah M' }],
      error: null,
    })

    const { getNotesByMaterialIds } = await import('@/lib/data/notes')
    const result = await getNotesByMaterialIds(['mat-1', 'mat-2', 'mat-3'])

    expect(result['mat-1']).toHaveLength(2)
    expect(result['mat-2']).toHaveLength(1)
    expect(result['mat-3']).toEqual([])
  })

  it('returns empty buckets for all ids on query error', async () => {
    notesOrder.mockResolvedValue({ data: null, error: { message: 'fail' } })
    const { getNotesByMaterialIds } = await import('@/lib/data/notes')
    const result = await getNotesByMaterialIds(['mat-1', 'mat-2'])
    expect(result).toEqual({ 'mat-1': [], 'mat-2': [] })
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
    expect(result[0]!.showId).toBe('show-1')
    expect(mockEq).toHaveBeenCalledWith('show_id', 'show-1')
  })
})
