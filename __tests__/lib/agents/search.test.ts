import { describe, it, expect } from 'vitest'
import { buildSearchPrompt, filterMaterialsByQuery } from '@/lib/agents/search'
import type { Material } from '@/lib/types/domain'

const mat = (overrides: Partial<Material> = {}): Material => ({
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Test Material',
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-06-14T00:00:00Z',
  ...overrides,
})

describe('filterMaterialsByQuery', () => {
  it('matches title case-insensitively', () => {
    const results = filterMaterialsByQuery([mat({ title: 'Dark Palette' })], 'dark')
    expect(results).toHaveLength(1)
  })
  it('matches tags', () => {
    const results = filterMaterialsByQuery([mat({ tags: ['act-1', 'warm'] })], 'act-1')
    expect(results).toHaveLength(1)
  })
  it('matches description', () => {
    const results = filterMaterialsByQuery([mat({ description: 'gothic arches' })], 'gothic')
    expect(results).toHaveLength(1)
  })
  it('matches body text for notes', () => {
    const results = filterMaterialsByQuery([mat({ type: 'note', body: 'minimalist staging' })], 'minimalist')
    expect(results).toHaveLength(1)
  })
  it('returns empty when nothing matches', () => {
    const results = filterMaterialsByQuery([mat({ title: 'Lighting Plot' })], 'costume')
    expect(results).toHaveLength(0)
  })
  it('returns multiple matching materials', () => {
    const mats = [
      mat({ id: 'a', title: 'Act 1 Scene 1' }),
      mat({ id: 'b', title: 'Act 2 Scene 1' }),
      mat({ id: 'c', title: 'Costume sketch' }),
    ]
    const results = filterMaterialsByQuery(mats, 'Act')
    expect(results).toHaveLength(2)
  })
})

describe('buildSearchPrompt', () => {
  it('includes the user query', () => {
    const prompt = buildSearchPrompt('dark moody palette', [mat({ title: 'Dark Light Plot' })], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('dark moody palette')
  })
  it('includes material titles', () => {
    const prompt = buildSearchPrompt('dark', [mat({ title: 'Dark Light Plot' })], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('Dark Light Plot')
  })
  it('includes show and department context', () => {
    const prompt = buildSearchPrompt('warm', [mat()], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('Hamlet')
    expect(prompt).toContain('Lighting Design')
  })
  it('requests JSON output', () => {
    const prompt = buildSearchPrompt('test', [mat()], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('JSON')
  })
})
