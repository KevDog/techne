'use client'

import { NoteList } from '@/components/NoteList'
import type { NoteWithAuthors } from '@/lib/types/domain'

type Props = {
  notes: NoteWithAuthors[]
  showId: string
}

export function ShowNotesSection({ notes, showId }: Props) {
  return (
    <section className="p-6 border-t border-zinc-200 dark:border-zinc-800">
      <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-4">
        Show Notes
      </p>
      <NoteList notes={notes} attachment={{ showId }} />
    </section>
  )
}
