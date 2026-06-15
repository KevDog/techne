import { describe, it, expect } from 'vitest'
import { buildTaggingPrompt } from '@/lib/agents/tagging'
import type { Material } from '@/lib/types/domain'

const material: Material = {
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Lighting plot Act 1',
  description: 'Overview of practical and theatrical lighting positions',
  url: null,
  storagePath: 'org-1/show-1/dept-1/uuid/plot.png',
  body: null,
  tags: [],
  createdAt: '2026-06-14T00:00:00Z',
}

describe('buildTaggingPrompt', () => {
  it('includes the material title', () => {
    const prompt = buildTaggingPrompt(material, 'Hamlet', 'Lighting Design', [])
    expect(prompt).toContain('Lighting plot Act 1')
  })
  it('includes the show name', () => {
    const prompt = buildTaggingPrompt(material, 'Hamlet', 'Lighting Design', [])
    expect(prompt).toContain('Hamlet')
  })
  it('includes the department name', () => {
    const prompt = buildTaggingPrompt(material, 'Hamlet', 'Lighting Design', [])
    expect(prompt).toContain('Lighting Design')
  })
  it('includes existing tags as context when provided', () => {
    const prompt = buildTaggingPrompt(material, 'Hamlet', 'Lighting Design', ['act-1', 'practical'])
    expect(prompt).toContain('act-1')
    expect(prompt).toContain('practical')
  })
  it('includes the material type', () => {
    const prompt = buildTaggingPrompt(material, 'Hamlet', 'Lighting Design', [])
    expect(prompt).toContain('image')
  })
  it('requests JSON output', () => {
    const prompt = buildTaggingPrompt(material, 'Hamlet', 'Lighting Design', [])
    expect(prompt).toContain('JSON')
  })
})
