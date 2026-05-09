import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── isValidTransition (pure — no mocks needed) ─────────────────────────────

describe('isValidTransition', () => {
  it('exploratory → proposed: allowed', async () => {
    const { isValidTransition } = await import('@/lib/actions/materials')
    expect(isValidTransition('exploratory', 'proposed', false)).toBe(true)
  })

  it('proposed → decided: allowed', async () => {
    const { isValidTransition } = await import('@/lib/actions/materials')
    expect(isValidTransition('proposed', 'decided', false)).toBe(true)
  })

  it('decided → proposed with allowReopen=true: allowed', async () => {
    const { isValidTransition } = await import('@/lib/actions/materials')
    expect(isValidTransition('decided', 'proposed', true)).toBe(true)
  })

  it('decided → proposed with allowReopen=false: blocked', async () => {
    const { isValidTransition } = await import('@/lib/actions/materials')
    expect(isValidTransition('decided', 'proposed', false)).toBe(false)
  })

  it('proposed → exploratory: never allowed', async () => {
    const { isValidTransition } = await import('@/lib/actions/materials')
    expect(isValidTransition('proposed', 'exploratory', true)).toBe(false)
  })

  it('exploratory → decided: never allowed', async () => {
    const { isValidTransition } = await import('@/lib/actions/materials')
    expect(isValidTransition('exploratory', 'decided', false)).toBe(false)
  })
})

// ── transitionState ────────────────────────────────────────────────────────

const mockMaterialSingle = vi.fn()
const mockDeptSingle = vi.fn()
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }))

const mockFromImpl = vi.fn((table: string) => {
  if (table === 'materials') {
    return {
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockMaterialSingle })) })),
      update: mockUpdate,
    }
  }
  if (table === 'departments') {
    return {
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockDeptSingle })) })),
    }
  }
  return {}
})

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    from: mockFromImpl,
    auth: { getUser: mockGetUser },
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('transitionState', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws on invalid transition', async () => {
    mockMaterialSingle.mockResolvedValue({
      data: { state: 'proposed', department_id: 'dept-1' },
      error: null,
    })
    mockDeptSingle.mockResolvedValue({
      data: { show_id: 'show-1', shows: { allow_reopen: false } },
      error: null,
    })
    const { transitionState } = await import('@/lib/actions/materials')
    await expect(transitionState('mat-1', 'exploratory')).rejects.toThrow('Invalid state transition')
  })

  it('updates state on valid transition', async () => {
    mockMaterialSingle.mockResolvedValue({
      data: { state: 'exploratory', department_id: 'dept-1' },
      error: null,
    })
    mockDeptSingle.mockResolvedValue({
      data: { show_id: 'show-1', shows: { allow_reopen: false } },
      error: null,
    })
    const { transitionState } = await import('@/lib/actions/materials')
    await transitionState('mat-1', 'proposed')
    expect(mockUpdate).toHaveBeenCalledWith({ state: 'proposed' })
  })
})
