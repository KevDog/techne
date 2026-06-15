import { describe, it, expect } from 'vitest'
import { buildSummaryPrompt } from '@/lib/agents/summary'
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

describe('buildSummaryPrompt', () => {
  it('includes department name', () => {
    const prompt = buildSummaryPrompt([mat()], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('Lighting Design')
  })
  it('includes show name', () => {
    const prompt = buildSummaryPrompt([mat()], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('Hamlet')
  })
  it('includes decided material titles', () => {
    const prompt = buildSummaryPrompt([mat({ title: 'Final Plot', state: 'decided' })], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('Final Plot')
  })
  it('includes proposed material titles', () => {
    const prompt = buildSummaryPrompt([mat({ title: 'Rough Sketch', state: 'proposed' })], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('Rough Sketch')
  })
  it('requests JSON output', () => {
    const prompt = buildSummaryPrompt([mat()], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('JSON')
  })
  it('counts decided vs proposed vs exploratory correctly', () => {
    const materials = [
      mat({ state: 'decided' }),
      mat({ state: 'decided' }),
      mat({ state: 'proposed' }),
      mat({ state: 'exploratory' }),
    ]
    const prompt = buildSummaryPrompt(materials, 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('2')
    expect(prompt).toContain('1')
  })
})
