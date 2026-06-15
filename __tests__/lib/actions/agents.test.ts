import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Material } from '@/lib/types/domain'

// Provide a dummy key so the env-guard in getClient() passes.
// The Anthropic SDK is fully mocked — no real network calls are made.
process.env.ANTHROPIC_API_KEY = 'test-key'

// ── Mock Anthropic SDK ────────────────────────────────────────────────────────

const mockCreate = vi.fn()

function MockAnthropic() {
  return { messages: { create: mockCreate } }
}

vi.mock('@anthropic-ai/sdk', () => ({
  default: MockAnthropic,
  Anthropic: MockAnthropic,
}))

// ── Mock Supabase ─────────────────────────────────────────────────────────────

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}))

// ── Mock next/cache ───────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// ── Shared material fixture ───────────────────────────────────────────────────

const material: Material = {
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Lighting Plot Act 1',
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-06-14T00:00:00Z',
}

// ── suggestTags ───────────────────────────────────────────────────────────────

describe('suggestTags', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns parsed tags and rationale from Claude response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"tags": ["act-1", "warm"], "rationale": "Focus on act reference."}' }],
    })
    const { suggestTags } = await import('@/lib/actions/agents')
    const result = await suggestTags(material, 'Hamlet', 'Lighting Design', [])
    expect(result.tags).toEqual(['act-1', 'warm'])
    expect(result.rationale).toBe('Focus on act reference.')
  })

  it('throws Unauthorized when no user session', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const { suggestTags } = await import('@/lib/actions/agents')
    await expect(suggestTags(material, 'Hamlet', 'Lighting Design', [])).rejects.toThrow('Unauthorized')
  })

  it('returns fallback on malformed Claude JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not valid json' }],
    })
    const { suggestTags } = await import('@/lib/actions/agents')
    const result = await suggestTags(material, 'Hamlet', 'Lighting Design', [])
    expect(result.tags).toEqual([])
    expect(typeof result.rationale).toBe('string')
  })
})

// ── searchWithSummary ─────────────────────────────────────────────────────────

describe('searchWithSummary', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns hits and Claude summary', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"summary": "The team favors warm practicals."}' }],
    })
    const { searchWithSummary } = await import('@/lib/actions/agents')
    const warmMaterial = { ...material, tags: ['warm', 'act-1'] }
    const result = await searchWithSummary(
      'warm',
      [warmMaterial],
      'Hamlet',
      'Lighting Design',
      { 'dept-1': 'Lighting Design' }
    )
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0]?.materialId).toBe('m-1')
    expect(result.summary).toBe('The team favors warm practicals.')
  })

  it('returns empty hits and no-results summary when nothing matches', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"summary": "No materials found for this query."}' }],
    })
    const { searchWithSummary } = await import('@/lib/actions/agents')
    const result = await searchWithSummary(
      'costume',
      [material],
      'Hamlet',
      'Lighting Design',
      { 'dept-1': 'Lighting Design' }
    )
    expect(result.hits).toHaveLength(0)
  })

  it('throws Unauthorized when no user session', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const { searchWithSummary } = await import('@/lib/actions/agents')
    await expect(
      searchWithSummary('test', [], 'Hamlet', 'Lighting', {})
    ).rejects.toThrow('Unauthorized')
  })
})

// ── summarizeDepartment ───────────────────────────────────────────────────────

describe('summarizeDepartment', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns department summary with counts', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: '{"summary": "The lighting direction is mostly decided.", "decidedCount": 2, "proposedCount": 1, "exploratoryCount": 0}',
      }],
    })
    const { summarizeDepartment } = await import('@/lib/actions/agents')
    const result = await summarizeDepartment(
      [
        { ...material, state: 'decided' },
        { ...material, id: 'm-2', state: 'decided' },
        { ...material, id: 'm-3', state: 'proposed' },
      ],
      'Hamlet',
      'Lighting Design'
    )
    expect(result.summary).toBe('The lighting direction is mostly decided.')
    expect(result.decidedCount).toBe(2)
    expect(result.proposedCount).toBe(1)
    expect(result.exploratoryCount).toBe(0)
  })

  it('throws Unauthorized when no user session', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const { summarizeDepartment } = await import('@/lib/actions/agents')
    await expect(summarizeDepartment([], 'Hamlet', 'Lighting Design')).rejects.toThrow('Unauthorized')
  })

  it('returns fallback on malformed Claude JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json' }],
    })
    const { summarizeDepartment } = await import('@/lib/actions/agents')
    const result = await summarizeDepartment([material], 'Hamlet', 'Lighting Design')
    expect(typeof result.summary).toBe('string')
    expect(typeof result.decidedCount).toBe('number')
  })
})
