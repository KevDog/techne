// Liveblocks v3 config
// v3 keeps createClient (from @liveblocks/client) + createRoomContext (from @liveblocks/react).
// The v2 → v3 change was internal; the public surface used here is unchanged.

import { createClient, LiveObject, LiveList } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'
import type { Note } from '@/lib/types/domain'

// ─── Presence ────────────────────────────────────────────────────────────────

export type LBPresence = {
  cursor: { x: number; y: number } | null
  activeNoteId: string | null
}

// ─── Storage ─────────────────────────────────────────────────────────────────

export type LBFilters = {
  tags: string[]
  authorId: string | null
}

export type LBStorage = {
  notes: LiveList<LiveObject<Note>>
  filters: LiveObject<LBFilters>
}

// ─── User meta ───────────────────────────────────────────────────────────────

export type LBUserMeta = {
  id: string
  info: {
    name: string
    initials: string
  }
}

// ─── Room events ─────────────────────────────────────────────────────────────

export type LBRoomEvent =
  | { type: 'NOTE_CREATED'; noteId: string }
  | { type: 'NOTE_DELETED'; noteId: string }
  | { type: 'MEETING_ENDED' }

// ─── Constants ───────────────────────────────────────────────────────────────

export const EMPTY_FILTERS: LBFilters = {
  tags: [],
  authorId: null,
}

export const INITIAL_STORAGE = (): LBStorage => ({
  notes: new LiveList([]),
  filters: new LiveObject(EMPTY_FILTERS),
})

// ─── Client + context ────────────────────────────────────────────────────────

const client = createClient({
  authEndpoint: '/api/liveblocks-auth',
})

const {
  RoomProvider,
  useStorage,
  useMutation,
  useOthers,
  useSelf,
  useBroadcastEvent,
  useEventListener,
  useUpdateMyPresence,
} = createRoomContext<LBPresence, LBStorage, LBUserMeta, LBRoomEvent>(client)

export {
  RoomProvider,
  useStorage,
  useMutation,
  useOthers,
  useSelf,
  useBroadcastEvent,
  useEventListener,
  useUpdateMyPresence,
}
