import { describe, it, expectTypeOf } from 'vitest'
import type { Department, Material, MaterialType, MaterialState } from '@/lib/types/domain'

describe('domain types', () => {
  it('Department has slug', () => {
    expectTypeOf<Department>().toMatchTypeOf<{ slug: string }>()
  })

  it('Material has required fields', () => {
    expectTypeOf<Material>().toMatchTypeOf<{
      id: string
      departmentId: string
      uploadedBy: string
      type: MaterialType
      state: MaterialState
      title: string
      tags: string[]
    }>()
  })

  it('MaterialState covers all states', () => {
    const s: MaterialState = 'exploratory'
    expectTypeOf(s).toEqualTypeOf<'exploratory' | 'proposed' | 'decided'>()
  })
})
