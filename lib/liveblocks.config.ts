import { createClient } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'
import type { MaterialState } from '@/lib/types/domain'

export type LBFilters = {
  department_ids: string[]
  tags: string[]
  states: MaterialState[]
}

export type LBStorage = {
  presenter_id: string | null
  presenter_request: { from_user_id: string; requested_at: number } | null
  active_meeting_id: string | null
  active_material_ids: string[]
  panel_sizes: number[]
  filters: LBFilters
}

export type LBPresence = {
  user_id: string
  current_material_id: string | null
  mode: 'browse' | 'follow'
  joined_at: number
}

export type LBUserMeta = {
  info: { name: string; initials: string }
}

export type LBRoomEvent = { type: 'navigate'; material_id: string }

export const EMPTY_FILTERS: LBFilters = {
  department_ids: [],
  tags: [],
  states: [],
}

export const INITIAL_STORAGE: LBStorage = {
  presenter_id: null,
  presenter_request: null,
  active_meeting_id: null,
  active_material_ids: [],
  panel_sizes: [],
  filters: EMPTY_FILTERS,
}

const client = createClient({ authEndpoint: '/api/liveblocks-auth' })

export const {
  RoomProvider,
  useStorage,
  useMutation,
  useOthers,
  useSelf,
  useBroadcastEvent,
  useEventListener,
  useUpdateMyPresence,
} = createRoomContext<LBPresence, LBStorage, LBUserMeta, LBRoomEvent>(client)
