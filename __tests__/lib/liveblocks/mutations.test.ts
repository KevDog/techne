import { describe, it, expect } from 'vitest'
import {
  claimPresenter, requestPresenter, yieldPresenter,
  clearPresenterRequest, releasePresenter,
  setActiveMaterials, setPanelSizes, setFilters,
} from '@/lib/liveblocks/mutations'
import type { LBStorage } from '@/lib/liveblocks.config'

function makeStorage(init: Partial<LBStorage> = {}) {
  const state: LBStorage = {
    presenter_id: null,
    presenter_request: null,
    active_meeting_id: null,
    active_material_ids: [],
    panel_sizes: [],
    filters: { department_ids: [], tags: [], states: [] },
    ...init,
  }
  return {
    get: <K extends keyof LBStorage>(k: K) => state[k],
    set: <K extends keyof LBStorage>(k: K, v: LBStorage[K]) => { state[k] = v as LBStorage[K] },
    _state: state,
  }
}

describe('claimPresenter', () => {
  it('sets presenter_id and clears any pending request', () => {
    const s = makeStorage({ presenter_request: { from_user_id: 'u2', requested_at: 1 } })
    claimPresenter(s, 'u1')
    expect(s._state.presenter_id).toBe('u1')
    expect(s._state.presenter_request).toBeNull()
  })
})

describe('requestPresenter', () => {
  it('writes presenter_request with user and timestamp', () => {
    const s = makeStorage()
    const before = Date.now()
    requestPresenter(s, 'u2')
    expect(s._state.presenter_request?.from_user_id).toBe('u2')
    expect(s._state.presenter_request?.requested_at).toBeGreaterThanOrEqual(before)
  })
})

describe('yieldPresenter', () => {
  it('sets presenter_id to requester and clears request', () => {
    const s = makeStorage({
      presenter_id: 'u1',
      presenter_request: { from_user_id: 'u2', requested_at: 1 },
    })
    yieldPresenter(s)
    expect(s._state.presenter_id).toBe('u2')
    expect(s._state.presenter_request).toBeNull()
  })

  it('is a no-op when no request is pending', () => {
    const s = makeStorage({ presenter_id: 'u1' })
    yieldPresenter(s)
    expect(s._state.presenter_id).toBe('u1')
  })
})

describe('clearPresenterRequest', () => {
  it('clears presenter_request without touching presenter_id', () => {
    const s = makeStorage({
      presenter_id: 'u1',
      presenter_request: { from_user_id: 'u2', requested_at: 1 },
    })
    clearPresenterRequest(s)
    expect(s._state.presenter_request).toBeNull()
    expect(s._state.presenter_id).toBe('u1')
  })
})

describe('releasePresenter', () => {
  it('clears presenter_id', () => {
    const s = makeStorage({ presenter_id: 'u1' })
    releasePresenter(s)
    expect(s._state.presenter_id).toBeNull()
  })
})

describe('setActiveMaterials', () => {
  it('caps at 4 materials', () => {
    const s = makeStorage()
    setActiveMaterials(s, ['a', 'b', 'c', 'd', 'e'])
    expect(s._state.active_material_ids).toHaveLength(4)
  })

  it('sets default panel sizes when none provided', () => {
    const s = makeStorage()
    setActiveMaterials(s, ['a', 'b'])
    expect(s._state.panel_sizes).toEqual([50, 50])
  })

  it('uses provided panel sizes', () => {
    const s = makeStorage()
    setActiveMaterials(s, ['a', 'b'], [60, 40])
    expect(s._state.panel_sizes).toEqual([60, 40])
  })
})

describe('setPanelSizes', () => {
  it('updates panel_sizes', () => {
    const s = makeStorage({ panel_sizes: [50, 50] })
    setPanelSizes(s, [70, 30])
    expect(s._state.panel_sizes).toEqual([70, 30])
  })
})

describe('setFilters', () => {
  it('updates filters', () => {
    const s = makeStorage()
    setFilters(s, { department_ids: ['d1'], tags: ['act-1'], states: ['proposed'] })
    expect(s._state.filters.department_ids).toEqual(['d1'])
    expect(s._state.filters.tags).toEqual(['act-1'])
    expect(s._state.filters.states).toEqual(['proposed'])
  })
})
