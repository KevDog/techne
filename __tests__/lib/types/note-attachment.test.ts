import { describe, expect, it } from 'vitest'
import { noteAttachment } from '@/lib/types/domain'

describe('noteAttachment', () => {
  it('returns material attachment when material_id set', () => {
    expect(noteAttachment({ materialId: 'm-1', showId: null, meetingId: null })).toEqual({
      kind: 'material',
      materialId: 'm-1',
    })
  })

  it('returns meeting attachment when meeting_id set', () => {
    expect(noteAttachment({ materialId: null, showId: null, meetingId: 'meet-1' })).toEqual({
      kind: 'meeting',
      meetingId: 'meet-1',
    })
  })

  it('returns show attachment when show_id set', () => {
    expect(noteAttachment({ materialId: null, showId: 's-1', meetingId: null })).toEqual({
      kind: 'show',
      showId: 's-1',
    })
  })

  it('returns null when no attachment id present', () => {
    expect(noteAttachment({ materialId: null, showId: null, meetingId: null })).toBeNull()
  })

  it('material takes precedence when multiple set (should not happen per DB constraint)', () => {
    const result = noteAttachment({ materialId: 'm-1', showId: 's-1', meetingId: 'meet-1' })
    expect(result).toEqual({ kind: 'material', materialId: 'm-1' })
  })
})
