'use client'

import type { Material, MaterialState } from '@/lib/types/domain'
import type { LBFilters } from '@/lib/liveblocks.config'

type Props = {
  materials: Material[]
  activeMaterialIds: string[]
  onToggle: (materialId: string) => void
  filters: LBFilters
  onFilterChange: (filters: LBFilters) => void
  departments: { id: string; name: string }[]
}

const ALL_STATES: MaterialState[] = ['exploratory', 'proposed', 'decided']

export function Filmstrip({
  materials, activeMaterialIds, onToggle,
  filters, onFilterChange, departments,
}: Props) {
  const tags = [...new Set(materials.flatMap((m) => m.tags))].sort()

  function toggleState(state: MaterialState) {
    const next = filters.states.includes(state)
      ? filters.states.filter((s) => s !== state)
      : [...filters.states, state]
    onFilterChange({ ...filters, states: next })
  }

  function toggleTag(tag: string) {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag]
    onFilterChange({ ...filters, tags: next })
  }

  function toggleDept(id: string) {
    const next = filters.department_ids.includes(id)
      ? filters.department_ids.filter((d) => d !== id)
      : [...filters.department_ids, id]
    onFilterChange({ ...filters, department_ids: next })
  }

  return (
    <div className="flex items-center gap-3 h-full">
      {/* Filter controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {departments.map((d) => (
          <button
            key={d.id}
            onClick={() => toggleDept(d.id)}
            className={`text-xs px-2 py-1 rounded ${
              filters.department_ids.includes(d.id)
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
            }`}
          >
            {d.name}
          </button>
        ))}
        {ALL_STATES.map((s) => (
          <button
            key={s}
            onClick={() => toggleState(s)}
            className={`text-xs px-2 py-1 rounded ${
              filters.states.includes(s)
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
            }`}
          >
            {s}
          </button>
        ))}
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => toggleTag(t)}
            className={`text-xs px-2 py-1 rounded ${
              filters.tags.includes(t)
                ? 'bg-purple-600 text-white'
                : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-neutral-700 flex-shrink-0" />

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto flex-1 py-1">
        {materials.map((m) => {
          const isActive = activeMaterialIds.includes(m.id)
          return (
            <button
              key={m.id}
              data-active={isActive ? '' : undefined}
              onClick={() => onToggle(m.id)}
              title={m.title}
              className={`flex-shrink-0 w-14 h-10 rounded border text-xs flex items-end p-0.5 overflow-hidden ${
                isActive
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-neutral-600 bg-neutral-800 hover:border-neutral-400'
              }`}
            >
              <span className="truncate text-neutral-300 text-[9px] w-full text-center">
                {m.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
