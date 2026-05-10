import { describe, it, expect } from 'vitest'
import { defaultPanelSizes } from '@/lib/liveblocks/layout'

describe('defaultPanelSizes', () => {
  it('returns [100] for 1 panel', () => {
    expect(defaultPanelSizes(1)).toEqual([100])
  })

  it('returns [50, 50] for 2 panels', () => {
    expect(defaultPanelSizes(2)).toEqual([50, 50])
  })

  it('returns [33, 33, 34] for 3 panels', () => {
    expect(defaultPanelSizes(3)).toEqual([33, 33, 34])
  })

  it('returns [25, 25, 25, 25] for 4 panels', () => {
    expect(defaultPanelSizes(4)).toEqual([25, 25, 25, 25])
  })

  it('throws for n < 1', () => {
    expect(() => defaultPanelSizes(0)).toThrow()
  })

  it('throws for n > 4', () => {
    expect(() => defaultPanelSizes(5)).toThrow()
  })

  it('sizes sum to 100', () => {
    for (const n of [1, 2, 3, 4]) {
      const sum = defaultPanelSizes(n).reduce((a, b) => a + b, 0)
      expect(sum).toBe(100)
    }
  })
})
