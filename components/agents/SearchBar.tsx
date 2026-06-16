'use client'

import { useState } from 'react'
import { searchWithSummary } from '@/lib/actions/agents'
import { useAsyncMutation } from '@/lib/hooks/useAsyncMutation'
import type { AgentSearchResult, Material, MaterialState } from '@/lib/types/domain'

type Props = {
  materials: Material[]
  showName: string
  departmentNameById: Record<string, string>
}

type SearchResultWithQuery = { result: AgentSearchResult; query: string }

const STATE_BADGE: Record<MaterialState, string> = {
  decided: 'bg-green-900 text-green-300',
  proposed: 'bg-amber-900 text-amber-300',
  exploratory: 'bg-neutral-700 text-neutral-400',
}

export function SearchBar({ materials, showName, departmentNameById }: Props) {
  const [query, setQuery] = useState('')
  const { state, run, reset } = useAsyncMutation<SearchResultWithQuery>('Search failed.')

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    if (!e.target.value.trim()) reset()
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    const deptNames = Object.values(departmentNameById)
    const deptName = deptNames.length === 1 ? deptNames[0]! : 'All departments'
    run(async () => {
      const result = await searchWithSummary(q, materials, showName, deptName, departmentNameById)
      return { result, query: q }
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
          <span
            className="text-xs text-purple-400 animate-pulse"
            aria-live="polite"
            aria-busy="true"
          >
            Searching…
          </span>
        )}
      </form>

      {state.phase === 'done' && (
        <div className="mt-2 bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-700 flex items-center justify-between">
            <span className="text-xs text-neutral-400">
              {state.result.result.hits.length} result{state.result.result.hits.length !== 1 ? 's' : ''} for &ldquo;{state.result.query}&rdquo;
            </span>
            <button
              onClick={reset}
              className="text-neutral-500 hover:text-neutral-300 text-sm"
              aria-label="Close search results"
            >
              ✕
            </button>
          </div>

          {state.result.result.summary && (
            <div className="px-3 py-2 bg-purple-950/30 border-b border-purple-900/50">
              <p className="text-[10px] text-purple-400 uppercase tracking-wider mb-1">AI Summary</p>
              <p className="text-xs text-purple-200">{state.result.result.summary}</p>
            </div>
          )}

          <ul className="divide-y divide-neutral-800 max-h-64 overflow-y-auto">
            {state.result.result.hits.length === 0 && (
              <li className="px-3 py-3 text-xs text-neutral-500">No matching materials found.</li>
            )}
            {state.result.result.hits.map((hit) => (
              <li key={hit.materialId} className="px-3 py-2 flex items-start gap-2">
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${STATE_BADGE[hit.state]}`}
                >
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
        <p className="mt-1 text-xs text-red-400" role="alert">
          {state.message}{' '}
          <button onClick={reset} className="underline">
            retry
          </button>
        </p>
      )}
    </div>
  )
}
