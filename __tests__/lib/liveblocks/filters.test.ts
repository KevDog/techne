import { describe, it, expect } from 'vitest'
import { filterMaterials } from '@/lib/liveblocks/filters'
import type { Material } from '@/lib/types/domain'

const mat = (overrides: Partial<Material> = {}): Material => ({
  id: 'mat-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Test',
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('filterMaterials', () => {
  it('returns all materials when all filters are empty', () => {
    const mats = [mat({ id: 'a' }), mat({ id: 'b' })]
    expect(filterMaterials(mats, { department_ids: [], tags: [], states: [] })).toHaveLength(2)
  })

  it('filters by department_ids', () => {
    const mats = [mat({ id: 'a', departmentId: 'dept-1' }), mat({ id: 'b', departmentId: 'dept-2' })]
    const result = filterMaterials(mats, { department_ids: ['dept-1'], tags: [], states: [] })
    expect(result.map(m => m.id)).toEqual(['a'])
  })

  it('filters by states', () => {
    const mats = [mat({ id: 'a', state: 'exploratory' }), mat({ id: 'b', state: 'proposed' })]
    const result = filterMaterials(mats, { department_ids: [], tags: [], states: ['proposed'] })
    expect(result.map(m => m.id)).toEqual(['b'])
  })

  it('filters by tags — material must have at least one matching tag', () => {
    const mats = [
      mat({ id: 'a', tags: ['act-1', 'dark'] }),
      mat({ id: 'b', tags: ['act-2'] }),
    ]
    const result = filterMaterials(mats, { department_ids: [], tags: ['act-1'], states: [] })
    expect(result.map(m => m.id)).toEqual(['a'])
  })

  it('applies all filters together (AND)', () => {
    const mats = [
      mat({ id: 'a', departmentId: 'dept-1', state: 'proposed', tags: ['act-1'] }),
      mat({ id: 'b', departmentId: 'dept-1', state: 'exploratory', tags: ['act-1'] }),
      mat({ id: 'c', departmentId: 'dept-2', state: 'proposed', tags: ['act-1'] }),
    ]
    const result = filterMaterials(mats, {
      department_ids: ['dept-1'],
      tags: ['act-1'],
      states: ['proposed'],
    })
    expect(result.map(m => m.id)).toEqual(['a'])
  })
})
