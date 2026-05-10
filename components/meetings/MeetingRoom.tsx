'use client'

import { useEffect, useRef } from 'react'
import {
  RoomProvider, useStorage, useMutation, useOthers, useSelf,
  useUpdateMyPresence, INITIAL_STORAGE,
} from '@/lib/liveblocks.config'
import {
  claimPresenter, requestPresenter, yieldPresenter,
  clearPresenterRequest, releasePresenter,
  setActiveMaterials, setPanelSizes, setFilters,
} from '@/lib/liveblocks/mutations'
import { filterMaterials } from '@/lib/liveblocks/filters'
import { startMeeting } from '@/lib/actions/meetings'
import { JoinPrompt } from '@/components/meetings/JoinPrompt'
import { LightTable } from '@/components/meetings/LightTable'
import { Filmstrip } from '@/components/meetings/Filmstrip'
import { PresenceBar } from '@/components/meetings/PresenceBar'
import { PresenterControls } from '@/components/meetings/PresenterControls'
import { FollowBanner } from '@/components/meetings/FollowBanner'
import { PresenterRequestToast } from '@/components/meetings/PresenterRequestToast'
import { NotesDrawer } from '@/components/meetings/NotesDrawer'
import { EndMeetingButton } from '@/components/meetings/EndMeetingButton'
import type { Material, NoteWithAuthors } from '@/lib/types/domain'
import type { LBFilters } from '@/lib/liveblocks.config'

type Props = {
  showId: string
  meetingId: string
  meetingTitle: string
  showName: string
  materials: Material[]
  notes: NoteWithAuthors[]
  departments: { id: string; name: string }[]
  canManage: boolean
  selfUserId: string
}

function MeetingRoomInner({
  showId: _showId, meetingId, meetingTitle, showName,
  materials, notes, departments, canManage,
  selfUserId,
}: Props) {
  const updatePresence = useUpdateMyPresence()
  const self = useSelf()
  const others = useOthers()

  const presenterId = useStorage((root) => root.presenter_id)
  const presenterRequest = useStorage((root) => root.presenter_request)
  const activeMeetingId = useStorage((root) => root.active_meeting_id)
  const activeMaterialIds = useStorage((root) => root.active_material_ids)
  const panelSizes = useStorage((root) => root.panel_sizes)
  const filters = useStorage((root) => root.filters)

  const selfMode = self?.presence.mode ?? null
  const hasJoined = selfMode !== null && self?.presence.joined_at !== 0
  const isSelfPresenter = presenterId === selfUserId
  const isFollowing = selfMode === 'follow' && presenterId !== null && !isSelfPresenter

  // Liveblocks mutations — defined before useEffect blocks that reference them
  const activeMeetingMutation = useMutation(({ storage }, id: string) => {
    storage.set('active_meeting_id', id)
  }, [])

  const cleanupPresenter = useMutation(({ storage }, disconnectedId: string) => {
    if (storage.get('presenter_id') === disconnectedId) {
      storage.set('presenter_id', null)
    }
    const req = storage.get('presenter_request')
    if (req?.from_user_id === disconnectedId) {
      storage.set('presenter_request', null)
    }
  }, [])

  const mutClaim = useMutation(({ storage }) => claimPresenter(storage, selfUserId), [selfUserId])
  const mutRequest = useMutation(({ storage }) => requestPresenter(storage, selfUserId), [selfUserId])
  const mutYield = useMutation(({ storage }) => yieldPresenter(storage), [])
  const mutDecline = useMutation(({ storage }) => clearPresenterRequest(storage), [])
  const mutRelease = useMutation(({ storage }) => releasePresenter(storage), [])
  const mutSetMaterials = useMutation(
    ({ storage }, ids: string[], sizes?: number[]) => setActiveMaterials(storage, ids, sizes),
    []
  )
  const mutSetPanelSizes = useMutation(
    ({ storage }, sizes: number[]) => setPanelSizes(storage, sizes),
    []
  )
  const mutSetFilters = useMutation(
    ({ storage }, f: LBFilters) => setFilters(storage, f),
    []
  )
  const mutClearMeeting = useMutation(({ storage }) => {
    storage.set('active_meeting_id', null)
  }, [])

  // Start meeting on first join
  const startedRef = useRef(false)

  useEffect(() => {
    if (!hasJoined || startedRef.current) return
    startedRef.current = true
    if (!activeMeetingId) {
      startMeeting(meetingId).then(() => {
        activeMeetingMutation(meetingId)
      })
    }
  }, [hasJoined, activeMeetingId, meetingId, activeMeetingMutation])

  // Presenter disconnect cleanup — oldest member (lowest joined_at) acts
  const allPresences = others.map((o) => o.presence)
  const selfJoinedAt = self?.presence.joined_at ?? Infinity
  const isOldest = allPresences.every((p) => selfJoinedAt <= p.joined_at)

  const prevOtherIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    const currentIds = new Set(others.map((o) => o.id as string))
    for (const id of prevOtherIds.current) {
      if (!currentIds.has(id) && isOldest) {
        cleanupPresenter(id)
      }
    }
    prevOtherIds.current = currentIds
  }, [others, isOldest, cleanupPresenter])

  // 30s presenter request timeout — requester's client clears on timeout
  useEffect(() => {
    if (!presenterRequest || presenterRequest.from_user_id !== selfUserId) return
    const id = setTimeout(() => mutDecline(), 30_000)
    return () => clearTimeout(id)
  }, [presenterRequest, selfUserId, mutDecline])

  // Effective light table state
  const effectiveIds = activeMaterialIds ?? []
  const effectiveSizes = panelSizes ?? []
  const effectiveFilters = filters ?? { department_ids: [], tags: [], states: [] }

  const visibleMaterials = filterMaterials(materials, effectiveFilters)
  const lightTableMaterials = materials.filter((m) => effectiveIds.includes(m.id))

  function handleToggleMaterial(id: string) {
    if (isFollowing) return
    const current = activeMaterialIds ?? []
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    mutSetMaterials(next)
  }

  function handleJoin(mode: 'browse' | 'follow') {
    updatePresence({ user_id: selfUserId, current_material_id: null, mode, joined_at: Date.now() })
  }

  // Presence bar data
  const allMembers = [
    ...(self ? [{ userId: self.id as string, presence: self.presence, info: self.info }] : []),
    ...others.map((o) => ({ userId: o.id as string, presence: o.presence, info: o.info })),
  ]
  const presenceBarMembers = allMembers.map((m) => ({
    userId: m.userId,
    name: m.info?.name ?? 'Unknown',
    initials: m.info?.initials ?? '?',
    isPresenter: m.userId === presenterId,
    mode: m.presence.mode,
  }))

  const presenterInfo = allMembers.find((m) => m.userId === presenterId)
  const requesterInfo = allMembers.find((m) => m.userId === presenterRequest?.from_user_id)

  // Meeting ended detection
  const isMeetingEnded = activeMeetingId === null && hasJoined && startedRef.current

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isFollowing) {
        updatePresence({ mode: 'browse' })
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (isFollowing) return
        const current = activeMaterialIds ?? []
        if (current.length !== 1) return
        const idx = visibleMaterials.findIndex((m) => m.id === current[0])
        const nextIdx = e.key === 'ArrowRight' ? idx + 1 : idx - 1
        const next = visibleMaterials[nextIdx]
        if (next) mutSetMaterials([next.id])
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isFollowing, activeMaterialIds, visibleMaterials, mutSetMaterials, updatePresence])

  if (!hasJoined) {
    return <JoinPrompt onJoin={handleJoin} />
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Top bar */}
      <div className="bg-neutral-900 border-b border-neutral-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-neutral-500 text-sm">{showName}</span>
          <span className="text-neutral-600">·</span>
          <span className="text-white text-sm font-medium">{meetingTitle}</span>
          <span className="bg-red-900/40 border border-red-800 text-red-400 text-xs px-1.5 py-0.5 rounded">
            ● Live
          </span>
        </div>
        <EndMeetingButton
          meetingId={meetingId}
          canManage={canManage}
          onEnd={mutClearMeeting}
        />
      </div>

      {/* Follow banner */}
      {isFollowing && presenterInfo && (
        <FollowBanner
          presenterName={presenterInfo.info?.name ?? 'Presenter'}
          onBrowseFreely={() => updatePresence({ mode: 'browse' })}
        />
      )}

      {/* Meeting ended banner */}
      {isMeetingEnded && (
        <div className="bg-neutral-800 border-b border-neutral-600 px-4 py-2 text-sm text-neutral-400 text-center">
          Meeting ended — browsing freely
        </div>
      )}

      {/* Light table */}
      <div className="flex-1 overflow-hidden p-2">
        <LightTable
          materials={lightTableMaterials}
          panelSizes={effectiveSizes}
          onPanelResize={isSelfPresenter ? mutSetPanelSizes : () => {}}
        />
      </div>

      {/* Bottom strip */}
      <div className="bg-neutral-900 border-t border-neutral-700 px-3 py-2 flex items-center gap-3 flex-shrink-0 relative">
        <div className="flex-1 overflow-hidden">
          <Filmstrip
            materials={visibleMaterials}
            activeMaterialIds={effectiveIds}
            onToggle={handleToggleMaterial}
            filters={effectiveFilters}
            onFilterChange={isSelfPresenter || !isFollowing ? mutSetFilters : () => {}}
            departments={departments}
          />
        </div>
        <div className="w-px h-8 bg-neutral-700 flex-shrink-0" />
        <PresenceBar members={presenceBarMembers} />
        <div className="w-px h-8 bg-neutral-700 flex-shrink-0" />
        <PresenterControls
          presenterId={presenterId ?? null}
          presenterRequest={presenterRequest ?? null}
          selfUserId={selfUserId}
          onClaim={mutClaim}
          onRequest={mutRequest}
          onRelease={mutRelease}
        />
        <div className="w-px h-8 bg-neutral-700 flex-shrink-0" />
        <NotesDrawer meetingId={meetingId} notes={notes} />
      </div>

      {/* Presenter request toast */}
      {isSelfPresenter && presenterRequest && requesterInfo && (
        <PresenterRequestToast
          requesterName={requesterInfo.info?.name ?? 'Someone'}
          onYield={mutYield}
          onDecline={mutDecline}
        />
      )}
    </div>
  )
}

export function MeetingRoom(props: Props) {
  return (
    <RoomProvider
      id={`show-${props.showId}`}
      initialPresence={{ user_id: props.selfUserId, current_material_id: null, mode: 'browse' as const, joined_at: 0 }}
      initialStorage={INITIAL_STORAGE}
    >
      <MeetingRoomInner {...props} />
    </RoomProvider>
  )
}
