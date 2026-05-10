import { defaultPanelSizes } from '@/lib/liveblocks/layout'
import type { LBStorage, LBFilters } from '@/lib/liveblocks.config'

export type StorageLike = {
  get<K extends keyof LBStorage>(key: K): LBStorage[K]
  set<K extends keyof LBStorage>(key: K, value: LBStorage[K]): void
}

export function claimPresenter(storage: StorageLike, userId: string) {
  storage.set('presenter_id', userId)
  storage.set('presenter_request', null)
}

export function requestPresenter(storage: StorageLike, userId: string) {
  storage.set('presenter_request', { from_user_id: userId, requested_at: Date.now() })
}

export function yieldPresenter(storage: StorageLike) {
  const req = storage.get('presenter_request')
  if (!req) return
  storage.set('presenter_id', req.from_user_id)
  storage.set('presenter_request', null)
}

export function clearPresenterRequest(storage: StorageLike) {
  storage.set('presenter_request', null)
}

export function releasePresenter(storage: StorageLike) {
  storage.set('presenter_id', null)
}

export function setActiveMaterials(
  storage: StorageLike,
  materialIds: string[],
  panelSizes?: number[]
) {
  const ids = materialIds.slice(0, 4)
  const sizes = panelSizes ?? defaultPanelSizes(Math.max(ids.length, 1))
  storage.set('active_material_ids', ids)
  storage.set('panel_sizes', sizes)
}

export function setPanelSizes(storage: StorageLike, sizes: number[]) {
  storage.set('panel_sizes', sizes)
}

export function setFilters(storage: StorageLike, filters: LBFilters) {
  storage.set('filters', filters)
}
