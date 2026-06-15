'use client'

import { useState, useTransition } from 'react'
import { searchWithSummary } from '@/lib/actions/agents'
import type { Material, AgentSearchResult, MaterialState } from '@/lib/types/domain'

type Props = {
  materials: Material[]
  showName: string
  departmentNameById: Record<string, string>
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; result: AgentSearchResult; query: string }
  | { phase: 'error'; message: string }

const STATE_BADGE: Record<MaterialState, string> = {
  decided: 'bg-green-900 text-green-300',
  proposed: 'bg-amber-900 text-amber-300',
  exploratory: 'bg-neutral-700 text-neutral-400',
}

export function SearchBar({ materials, showName, departmentNameById }: Props) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    if (!e.target.value.trim()) {
      setState({ phase: 'idle' })
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    const deptName = Object.values(departmentNameById)[0] ?? 'All departments'
    setState({ phase: 'loading' })
    startTransition(async () => {
      try {
        const result = await searchWithSummary(q, materials, showName, deptName, departmentNameById)
        setState({ phase: 'done', result, query: q })
      } catch {
        setState({ phase: 'error', message: 'Search failed.' })
      }
    })
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <span className="text-purple-400 text-sm">✦</span>
        <input
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="Search materials…"
          className="flex-1 bg-neutral-800 border border-neutral-700 focus:border-purple-600 rounded px-3 py-1.5 text-sm text-white placeholder-neutral-500 outline-none"
        />
        {state.phase === 'loading' && (
          <span className="text-xs text-purple-400 animate-pulse">Searching…</span>
        )}
      </form>

      {state.phase === 'done' && (
        <div className="mt-2 bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-700 flex items-center justify-between">
            <span className="text-xs text-neutral-400">
              {state.result.hits.length} result{state.result.hits.length !== 1 ? 's' : ''} for &ldquo;{state.query}&rdquo;
            </span>
            <button
              onClick={() => setState({ phase: 'idle' })}
              className="text-neutral-500 hover:text-neutral-300 text-sm"
            >
              ✕
            </button>
          </div>

          {state.result.summary && (
            <div className="px-3 py-2 bg-purple-950/30 border-b border-purple-900/50">
              <p className="text-[10px] text-purple-400 uppercase tracking-wider mb-1">AI Summary</p>
              <p className="text-xs text-purple-200">{state.result.summary}</p>
            </div>
          )}

          <ul className="divide-y divide-neutral-800 max-h-64 overflow-y-auto">
            {state.result.hits.length === 0 && (
              <li className="px-3 py-3 text-xs text-neutral-500">No matching materials found.</li>
            )}
            {state.result.hits.map((hit) => (
              <li key={hit.materialId} className="px-3 py-2 flex items-start gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${STATE_BADGE[hit.state]}`}>
                  {hit.state}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{hit.title}</p>
                  <p className="text-[10px] text-neutral-500">{hit.department}</p>
                  {hit.snippet && (
                    <p className="text-xs text-neutral-400 truncate">{hit.snippet}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.phase === 'error' && (
        <p className="mt-1 text-xs text-red-400">{state.message}</p>
      )}
    </div>
  )
}
