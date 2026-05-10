import { describe, it, expectTypeOf } from 'vitest'
import type { Department, Material, MaterialType, MaterialState, Note, NoteWithAuthors } from '@/lib/types/domain'

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
    expectTypeOf<MaterialState>().toEqualTypeOf<'exploratory' | 'proposed' | 'decided'>()
  })
})

describe('Note types', () => {
  it('Note has required fields', () => {
    expectTypeOf<Note>().toHaveProperty('id')
    expectTypeOf<Note>().toHaveProperty('body')
    expectTypeOf<Note>().toHaveProperty('tags')
    expectTypeOf<Note>().toHaveProperty('createdBy')
    expectTypeOf<Note>().toHaveProperty('updatedBy')
    expectTypeOf<Note>().toHaveProperty('hiddenAt')
    expectTypeOf<Note>().toHaveProperty('materialId')
    expectTypeOf<Note>().toHaveProperty('showId')
    expectTypeOf<Note>().toHaveProperty('meetingId')
  })

  it('NoteWithAuthors extends Note with name fields', () => {
    expectTypeOf<NoteWithAuthors>().toHaveProperty('createdByName')
    expectTypeOf<NoteWithAuthors>().toHaveProperty('updatedByName')
  })

  it('hiddenAt is string or null', () => {
    expectTypeOf<Note['hiddenAt']>().toEqualTypeOf<string | null>()
  })
})
