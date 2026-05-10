'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { createMaterial, transitionState, updateTags, deleteMaterial } from '@/lib/actions/materials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { MaterialWithUrl } from '@/lib/data/materials'
import type { MaterialType, MaterialState, NoteWithAuthors } from '@/lib/types/domain'
import { NoteList } from '@/components/NoteList'

type Props = {
  materials: MaterialWithUrl[]
  notesByMaterial: Record<string, NoteWithAuthors[]>
  orgId: string
  showId: string
  deptId: string
  allowReopen: boolean
}

type TabFilter = 'all' | MaterialState

const STATE_COLORS: Record<MaterialState, { bg: string; text: string }> = {
  exploratory: { bg: 'bg-indigo-900/50', text: 'text-indigo-300' },
  proposed:    { bg: 'bg-amber-900/50',  text: 'text-amber-300'  },
  decided:     { bg: 'bg-green-900/50',  text: 'text-green-300'  },
}

const TYPE_ICONS: Record<MaterialType, string> = {
  image: '🖼',
  file:  '📄',
  link:  '🔗',
  note:  '📝',
}

function StateBadge({ state }: { state: MaterialState }) {
  const { bg, text } = STATE_COLORS[state]
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${bg} ${text}`}>
      {state}
    </span>
  )
}

export function DepartmentClient({ materials, notesByMaterial, orgId, showId, deptId, allowReopen }: Props) {
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [selected, setSelected] = useState<MaterialWithUrl | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [, startTransition] = useTransition()

  const filtered = activeTab === 'all'
    ? materials
    : materials.filter((m) => m.state === activeTab)

  const counts = {
    all:         materials.length,
    decided:     materials.filter((m) => m.state === 'decided').length,
    proposed:    materials.filter((m) => m.state === 'proposed').length,
    exploratory: materials.filter((m) => m.state === 'exploratory').length,
  }

  function handleTransition(materialId: string, target: MaterialState) {
    startTransition(async () => {
      await transitionState(materialId, target)
      setSelected(null)
    })
  }

  function handleDelete(materialId: string) {
    startTransition(async () => {
      await deleteMaterial(materialId)
      setSelected(null)
    })
  }

  return (
    <div className="flex relative">
      {/* Main list */}
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex gap-0">
            {(['all', 'decided', 'proposed', 'exploratory'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-zinc-900 dark:text-zinc-100 border-b-2 border-indigo-500'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {tab === 'all' ? `All (${counts.all})` : `${tab.charAt(0).toUpperCase() + tab.slice(1)} (${counts[tab]})`}
              </button>
            ))}
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            + Add Material
          </button>
        </div>

        {/* Materials list */}
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {filtered.length === 0 && (
            <li className="px-6 py-8 text-sm text-zinc-500 text-center">No materials yet.</li>
          )}
          {filtered.map((material) => (
            <li
              key={material.id}
              onClick={() => setSelected(material)}
              className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            >
              {/* Thumbnail or icon */}
              <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-xl">
                {material.type === 'image' && material.signedUrl ? (
                  <Image
                    src={material.signedUrl}
                    alt={material.title}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  TYPE_ICONS[material.type]
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {material.title}
                  </span>
                  <StateBadge state={material.state} />
                  <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                    {material.type}
                  </span>
                </div>
                {material.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {material.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-zinc-400 shrink-0">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </li>
          ))}
        </ul>
      </div>

      {/* Detail slide-over */}
      {selected && (
        <DetailPanel
          material={selected}
          notes={notesByMaterial[selected.id] ?? []}
          allowReopen={allowReopen}
          onClose={() => setSelected(null)}
          onTransition={handleTransition}
          onTagsChange={(newTags) => {
            setSelected((prev) => prev ? { ...prev, tags: newTags } : null)
          }}
          onDelete={handleDelete}
        />
      )}

      {/* Upload slide-over */}
      {uploadOpen && (
        <UploadPanel
          orgId={orgId}
          showId={showId}
          deptId={deptId}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </div>
  )
}

// ── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  material,
  notes,
  allowReopen,
  onClose,
  onTransition,
  onTagsChange,
  onDelete,
}: {
  material: MaterialWithUrl
  notes: NoteWithAuthors[]
  allowReopen: boolean
  onClose: () => void
  onTransition: (id: string, target: MaterialState) => void
  onTagsChange: (tags: string[]) => void
  onDelete: (id: string) => void
}) {
  const [newTag, setNewTag] = useState('')

  function addTag() {
    const tag = newTag.trim()
    if (!tag) return
    const updated = [...material.tags, tag]
    onTagsChange(updated)
    setNewTag('')
    updateTags(material.id, updated)
  }

  return (
    <aside className="w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800 p-5 overflow-y-auto bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {material.title}
        </h2>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <StateBadge state={material.state} />
        <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
          {material.type}
        </span>
      </div>

      {/* Content area */}
      {material.type === 'image' && material.signedUrl && (
        <div className="mb-4 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
          <Image
            src={material.signedUrl}
            alt={material.title}
            width={300}
            height={200}
            className="w-full object-cover"
          />
        </div>
      )}
      {material.type === 'file' && material.signedUrl && (
        <a
          href={material.signedUrl}
          download
          className="mb-4 flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          📄 Download file
        </a>
      )}
      {material.type === 'link' && material.url && (
        <a
          href={material.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline break-all"
        >
          🔗 {material.url}
        </a>
      )}
      {material.type === 'note' && material.body && (
        <p className="mb-4 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
          {material.body}
        </p>
      )}

      {/* Tags */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Tags</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {material.tags.map((tag) => (
            <span key={tag} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addTag() }}
            placeholder="add tag…"
            className="flex-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 bg-transparent text-zinc-900 dark:text-zinc-100"
          />
          <button
            onClick={() => addTag()}
            className="text-xs text-indigo-600 dark:text-indigo-400 px-2"
          >
            +
          </button>
        </div>
      </div>

      {/* Notes */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 mt-4 pt-4">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-3">Notes</p>
        <NoteList notes={notes} attachment={{ materialId: material.id }} />
      </div>

      {/* State transitions */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mb-4">
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">State</p>
        {material.state === 'exploratory' && (
          <button
            onClick={() => onTransition(material.id, 'proposed')}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Propose →
          </button>
        )}
        {material.state === 'proposed' && (
          <button
            onClick={() => onTransition(material.id, 'decided')}
            className="w-full rounded-md bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-500"
          >
            Approve → Decided
          </button>
        )}
        {material.state === 'decided' && allowReopen && (
          <button
            onClick={() => onTransition(material.id, 'proposed')}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Reopen → Proposed
          </button>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(material.id)}
        className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
      >
        Delete material
      </button>
    </aside>
  )
}

// ── Upload Panel ──────────────────────────────────────────────────────────────

function UploadPanel({
  orgId,
  showId,
  deptId,
  onClose,
}: {
  orgId: string
  showId: string
  deptId: string
  onClose: () => void
}) {
  const [type, setType] = useState<MaterialType>('image')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setUploading(true)

    let uploadedPath: string | undefined
    try {
      if ((type === 'image' || type === 'file') && file) {
        const MAX_BYTES = 50 * 1024 * 1024
        if (file.size > MAX_BYTES) throw new Error('File exceeds 50 MB limit')
        if (type === 'image' && !file.type.startsWith('image/')) throw new Error('File is not an image')
        const supabase = createSupabaseBrowserClient()
        const uploadUuid = crypto.randomUUID()
        uploadedPath = `${orgId}/${showId}/${deptId}/${uploadUuid}/${file.name}`
        const { error } = await supabase.storage.from('materials').upload(uploadedPath, file)
        if (error) throw error
      }

      await createMaterial(deptId, type, {
        title: title.trim(),
        description: description.trim() || undefined,
        url: type === 'link' ? url.trim() : undefined,
        storagePath: uploadedPath,
        body: type === 'note' ? body.trim() : undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      })

      onClose()
    } catch (err) {
      if (uploadedPath) {
        const supabase = createSupabaseBrowserClient()
        await supabase.storage.from('materials').remove([uploadedPath])
      }
      throw err
    } finally {
      setUploading(false)
    }
  }

  return (
    <aside className="w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800 p-5 overflow-y-auto bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add Material</h2>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Type selector */}
        <div>
          <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Type</label>
          <div className="flex gap-1">
            {(['image', 'file', 'link', 'note'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 text-xs rounded capitalize ${
                  type === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Conditional fields */}
        {(type === 'image' || type === 'file') && (
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">File</label>
            <input
              type="file"
              accept={type === 'image' ? 'image/*' : undefined}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs text-zinc-700 dark:text-zinc-300 w-full"
            />
          </div>
        )}
        {type === 'link' && (
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100"
            />
          </div>
        )}
        {type === 'note' && (
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Note</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100 resize-none"
            />
          </div>
        )}

        {/* Title */}
        <div>
          <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="act-1, scenic, reference"
            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="mt-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Add Material'}
        </button>
      </form>
    </aside>
  )
}
