import { describe, expect, it } from 'vitest'
import {
  ApprovalModeSchema,
  MaterialStateSchema,
  MaterialTypeSchema,
  OrgSettingsSchema,
  parseSeason,
} from '@/lib/schemas/db-rows'

describe('MaterialTypeSchema', () => {
  it('accepts known types', () => {
    expect(MaterialTypeSchema.parse('image')).toBe('image')
    expect(MaterialTypeSchema.parse('note')).toBe('note')
    expect(MaterialTypeSchema.parse('file')).toBe('file')
    expect(MaterialTypeSchema.parse('link')).toBe('link')
  })

  it('rejects unknown types', () => {
    expect(() => MaterialTypeSchema.parse('video')).toThrow()
  })
})

describe('MaterialStateSchema', () => {
  it('accepts the three states', () => {
    expect(MaterialStateSchema.parse('exploratory')).toBe('exploratory')
    expect(MaterialStateSchema.parse('proposed')).toBe('proposed')
    expect(MaterialStateSchema.parse('decided')).toBe('decided')
  })

  it('rejects unknown states', () => {
    expect(() => MaterialStateSchema.parse('archived')).toThrow()
  })
})

describe('ApprovalModeSchema', () => {
  it('accepts single and multi', () => {
    expect(ApprovalModeSchema.parse('single')).toBe('single')
    expect(ApprovalModeSchema.parse('multi')).toBe('multi')
  })

  it('rejects unknown modes', () => {
    expect(() => ApprovalModeSchema.parse('hybrid')).toThrow()
  })
})

describe('OrgSettingsSchema', () => {
  it('parses well-formed settings', () => {
    expect(OrgSettingsSchema.parse({ claudeEnabled: true })).toEqual({ claudeEnabled: true })
  })

  it('falls back to claudeEnabled:false for malformed input', () => {
    expect(OrgSettingsSchema.parse({})).toEqual({ claudeEnabled: false })
    expect(OrgSettingsSchema.parse(null)).toEqual({ claudeEnabled: false })
    expect(OrgSettingsSchema.parse('not an object')).toEqual({ claudeEnabled: false })
  })
})

describe('parseSeason', () => {
  it('returns null for null', () => {
    expect(parseSeason(null)).toBeNull()
  })

  it('unwraps an array form', () => {
    expect(parseSeason([{ name: 'Spring 26', slug: 'spring-26' }])).toEqual({
      name: 'Spring 26',
      slug: 'spring-26',
    })
  })

  it('accepts a direct object', () => {
    expect(parseSeason({ name: 'Fall 26', slug: 'fall-26' })).toEqual({
      name: 'Fall 26',
      slug: 'fall-26',
    })
  })

  it('returns null for malformed input', () => {
    expect(parseSeason({ name: 'no slug' })).toBeNull()
  })
})
