'use client'

import { useState, useTransition } from 'react'
import ReactMarkdown from 'react-markdown'
import { createNote, updateNote, hideNote, restoreNote } from '@/lib/actions/notes'
import type { NoteWithAuthors } from '@/lib/types/domain'

type Attachment = { materialId: string } | { showId: string }

type Props = {
  notes: NoteWithAuthors[]
  attachment: Attachment
}

export function NoteList({ notes, attachment }: Props) {
  const [showHidden, setShowHidden] = useState(false)
  const [composerBody, setComposerBody] = useState('')
  const [composerTags, setComposerTags] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editBody, setEditBody] = useState('')
  const [editTags, setEditTags] = useState('')
  const [, startTransition] = useTransition()

  const hiddenCount = notes.filter((n) => n.hiddenAt).length
  const visibleNotes = showHidden ? notes : notes.filter((n) => !n.hiddenAt)

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault()
    if (!composerBody.trim()) return
    const tags = composerTags.split(',').map((t) => t.trim()).filter(Boolean)
    startTransition(async () => {
      await createNote(attachment, { body: composerBody.trim(), tags })
      setComposerBody('')
      setComposerTags('')
    })
  }

  function startEdit(note: NoteWithAuthors) {
    setEditingId(note.id)
    setEditBody(note.body)
    setEditTags(note.tags.join(', '))
  }

  function handleSaveEdit(noteId: string) {
    const tags = editTags.split(',').map((t) => t.trim()).filter(Boolean)
    startTransition(async () => {
      await updateNote(noteId, { body: editBody.trim(), tags })
      setEditingId(null)
    })
  }

  function handleHide(noteId: string) {
    startTransition(() => hideNote(noteId))
  }

  function handleRestore(noteId: string) {
    startTransition(() => restoreNote(noteId))
  }

  return (
    <div>
      <form onSubmit={handleAddNote} className="mb-4 flex flex-col gap-2">
        <textarea
          value={composerBody}
          onChange={(e) => setComposerBody(e.target.value)}
          placeholder="Add a note… (markdown supported)"
          rows={3}
          className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100 resize-none"
        />
        <input
          value={composerTags}
          onChange={(e) => setComposerTags(e.target.value)}
          placeholder="Tags (comma-separated)"
          className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100"
        />
        <button
          type="submit"
          disabled={!composerBody.trim()}
          className="self-end text-xs bg-indigo-600 text-white px-3 py-1.5 rounded disabled:opacity-40"
        >
          Add note
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {visibleNotes.map((note) => (
          <NoteItem
            key={note.id}
            note={note}
            isEditing={editingId === note.id}
            editBody={editBody}
            editTags={editTags}
            onEditBodyChange={setEditBody}
            onEditTagsChange={setEditTags}
            onStartEdit={() => startEdit(note)}
            onSaveEdit={() => handleSaveEdit(note.id)}
            onCancelEdit={() => setEditingId(null)}
            onHide={() => handleHide(note.id)}
            onRestore={() => handleRestore(note.id)}
          />
        ))}
      </div>

      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowHidden((v) => !v)}
          className="mt-3 text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        >
          {showHidden ? 'Hide hidden notes' : `Show hidden (${hiddenCount})`}
        </button>
      )}
    </div>
  )
}

function NoteItem({
  note, isEditing, editBody, editTags,
  onEditBodyChange, onEditTagsChange,
  onStartEdit, onSaveEdit, onCancelEdit,
  onHide, onRestore,
}: {
  note: NoteWithAuthors
  isEditing: boolean
  editBody: string
  editTags: string
  onEditBodyChange: (v: string) => void
  onEditTagsChange: (v: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onHide: () => void
  onRestore: () => void
}) {
  const isHidden = !!note.hiddenAt
  const wasEdited = note.updatedAt !== note.createdAt

  return (
    <div
      className={`rounded border p-3 text-sm ${
        isHidden
          ? 'border-zinc-200 dark:border-zinc-800 opacity-50'
          : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/50'
      }`}
    >
      {isEditing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={editBody}
            onChange={(e) => onEditBodyChange(e.target.value)}
            rows={4}
            autoFocus
            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100 resize-none"
          />
          <input
            value={editTags}
            onChange={(e) => onEditTagsChange(e.target.value)}
            placeholder="Tags (comma-separated)"
            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              className="text-xs bg-indigo-600 text-white px-2.5 py-1 rounded"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 px-2.5 py-1"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="prose prose-sm dark:prose-invert max-w-none mb-2">
            <ReactMarkdown>{note.body}</ReactMarkdown>
          </div>

          {note.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-2">
              {note.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              {note.createdByName}
              {wasEdited && note.updatedByName !== note.createdByName
                ? ` · edited by ${note.updatedByName}`
                : wasEdited
                  ? ' · edited'
                  : ''}
            </span>
            <div className="flex gap-2">
              {isHidden ? (
                <button
                  type="button"
                  onClick={onRestore}
                  className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                >
                  Restore
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={onStartEdit}
                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={onHide}
                    className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                  >
                    Hide
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
