'use client'

import { useState, useTransition } from 'react'
import ReactMarkdown from 'react-markdown'
import { addMeetingNote, hideMeetingNote } from '@/lib/actions/meetings'
import type { NoteWithAuthors } from '@/lib/types/domain'

type Props = {
  meetingId: string
  notes: NoteWithAuthors[]
}

export function NotesDrawer({ meetingId, notes }: Props) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit() {
    if (!body.trim()) return
    startTransition(async () => {
      await addMeetingNote(meetingId, body.trim())
      setBody('')
    })
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-neutral-400 hover:text-white px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700"
      >
        Notes {open ? '↓' : '↑'}
      </button>

      {open && (
        <div className="absolute bottom-14 left-0 right-0 bg-neutral-900 border-t border-neutral-700 p-4 max-h-56 overflow-y-auto">
          <div className="space-y-2 mb-3">
            {notes.filter((n) => !n.hiddenAt).map((n) => (
              <div key={n.id} className="bg-neutral-800 rounded px-3 py-2 flex gap-2 text-sm">
                <span className="text-neutral-500 text-xs flex-shrink-0 mt-0.5">{n.createdByName}</span>
                <div className="prose prose-invert prose-xs flex-1 min-w-0">
                  <ReactMarkdown>{n.body}</ReactMarkdown>
                </div>
                <button
                  onClick={() => startTransition(() => hideMeetingNote(n.id))}
                  className="text-neutral-600 hover:text-neutral-400 text-xs flex-shrink-0"
                >
                  hide
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit()}
              placeholder="Add a note..."
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={submit}
              disabled={isPending || !body.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
