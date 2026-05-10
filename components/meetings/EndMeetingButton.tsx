'use client'

import { useTransition } from 'react'
import { endMeeting } from '@/lib/actions/meetings'

type Props = {
  meetingId: string
  canManage: boolean
  onEnd: () => void
}

export function EndMeetingButton({ meetingId, canManage, onEnd }: Props) {
  const [isPending, startTransition] = useTransition()

  if (!canManage) return null

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await endMeeting(meetingId)
          onEnd()
        })
      }
      disabled={isPending}
      className="text-xs bg-red-900/40 hover:bg-red-900/70 border border-red-800 text-red-400 px-3 py-1.5 rounded disabled:opacity-40"
    >
      End Meeting
    </button>
  )
}
