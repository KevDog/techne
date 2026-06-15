'use client'

import { useState, useTransition } from 'react'
import { suggestTags } from '@/lib/actions/agents'
import type { Material } from '@/lib/types/domain'

type Props = {
  material: Material
  showName: string
  departmentName: string
  existingTags: string[]
  onAccept: (tags: string[]) => void
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; tags: string[]; rationale: string }
  | { phase: 'error'; message: string }

export function TagSuggestionButton({
  material,
  showName,
  departmentName,
  existingTags,
  onAccept,
}: Props): React.ReactElement {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [, startTransition] = useTransition()

  function handleSuggest(): void {
    setState({ phase: 'loading' })
    startTransition(async () => {
      try {
        const result = await suggestTags(material, showName, departmentName, existingTags)
        setState({ phase: 'done', tags: result.tags, rationale: result.rationale })
      } catch {
        setState({ phase: 'error', message: 'Failed to get suggestions.' })
      }
    })
  }

  function handleAcceptAll(): void {
    if (state.phase !== 'done') return
    onAccept(state.tags)
    setState({ phase: 'idle' })
  }

  function handleDismiss(): void {
    setState({ phase: 'idle' })
  }

  if (state.phase === 'idle') {
    return (
      <button
        onClick={handleSuggest}
        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 border border-purple-800 hover:border-purple-600 rounded px-2 py-1 transition-colors"
      >
        <span>✦</span>
        Suggest tags
      </button>
    )
  }

  if (state.phase === 'loading') {
    return <span className="text-xs text-purple-400 animate-pulse">Thinking…</span>
  }

  if (state.phase === 'error') {
    return (
      <span className="text-xs text-red-400">
        {state.message}{' '}
        <button onClick={handleDismiss} className="underline">
          dismiss
        </button>
      </span>
    )
  }

  // phase === 'done'
  return (
    <div className="mt-2 p-2 bg-purple-950/30 border border-purple-800 rounded text-xs space-y-2">
      <p className="text-purple-300 text-[10px] uppercase tracking-wider">AI suggestions</p>
      <div className="flex flex-wrap gap-1">
        {state.tags.map((tag) => (
          <span key={tag} className="bg-purple-900/50 text-purple-200 px-2 py-0.5 rounded">
            {tag}
          </span>
        ))}
      </div>
      {state.rationale && <p className="text-purple-400 text-[10px]">{state.rationale}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleAcceptAll}
          className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded"
        >
          Accept all
        </button>
        <button onClick={handleDismiss} className="text-xs text-purple-400 hover:text-purple-300">
          Dismiss
        </button>
      </div>
    </div>
  )
}
