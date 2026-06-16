import { describe, expect, it } from 'vitest'
import { sanitizeForPrompt, sanitizeTags } from '@/lib/agents/sanitize'

describe('sanitizeForPrompt', () => {
  it('preserves normal text', () => {
    expect(sanitizeForPrompt('Hamlet — Act 3 "to be or not to be"')).toBe(
      'Hamlet — Act 3 "to be or not to be"'
    )
  })

  it('strips ASCII control chars', () => {
    expect(sanitizeForPrompt('hello\x00world\x07!')).toBe('helloworld!')
  })

  it('neutralizes triple backticks', () => {
    expect(sanitizeForPrompt('```malicious code block```')).not.toContain('```')
  })

  it('truncates to max length', () => {
    expect(sanitizeForPrompt('x'.repeat(100), 10)).toHaveLength(10)
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeForPrompt('  text  ')).toBe('text')
  })
})

describe('sanitizeTags', () => {
  it('keeps clean tags', () => {
    expect(sanitizeTags(['act-1', 'warm-tones'])).toEqual(['act-1', 'warm-tones'])
  })

  it('removes empty results after sanitization', () => {
    expect(sanitizeTags(['', '   ', 'act-1'])).toEqual(['act-1'])
  })

  it('caps total tag count', () => {
    const tags = Array.from({ length: 50 }, (_, i) => `tag-${i}`)
    expect(sanitizeTags(tags)).toHaveLength(20)
  })
})
