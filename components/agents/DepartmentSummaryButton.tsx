'use client'

import { useState, useTransition } from 'react'
import { summarizeDepartment } from '@/lib/actions/agents'
import type { Material, AgentSummaryResult } from '@/lib/types/domain'

type Props = {
  materials: Material[]
  showName: string
  departmentName: string
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; result: AgentSummaryResult }
  | { phase: 'error'; message: string }

export function DepartmentSummaryButton({ materials, showName, departmentName }: Props): React.ReactElement {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [, startTransition] = useTransition()

  function handleSummarize(): void {
    setState({ phase: 'loading' })
    startTransition(async () => {
      try {
        const result = await summarizeDepartment(materials, showName, departmentName)
        setState({ phase: 'done', result })
      } catch {
        setState({ phase: 'error', message: 'Failed to generate summary.' })
      }
    })
  }

  if (state.phase === 'idle') {
    return (
      <button
        onClick={handleSummarize}
        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 border border-purple-800 hover:border-purple-600 rounded px-2 py-1 transition-colors"
      >
        <span>✦</span>
        Where we've landed
      </button>
    )
  }

  if (state.phase === 'loading') {
    return <span className="text-xs text-purple-400 animate-pulse">Summarizing…</span>
  }

  if (state.phase === 'error') {
    return (
      <span className="text-xs text-red-400">
        {state.message}{' '}
        <button onClick={() => setState({ phase: 'idle' })} className="underline">retry</button>
      </span>
    )
  }

  // phase === 'done'
  const { result } = state
  return (
    <div className="bg-purple-950/30 border border-purple-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-purple-400 uppercase tracking-wider">
          ✦ Where we've landed — {departmentName}
        </p>
        <button
          onClick={() => setState({ phase: 'idle' })}
          className="text-purple-500 hover:text-purple-300 text-sm"
        >
          Dismiss
        </button>
      </div>
      <p className="text-sm text-purple-100">{result.summary}</p>
      <div className="flex gap-4 text-xs">
        <span className="text-green-400">
          <span className="font-semibold">{result.decidedCount}</span> decided
        </span>
        <span className="text-amber-400">
          <span className="font-semibold">{result.proposedCount}</span> proposed
        </span>
        <span className="text-neutral-400">
          <span className="font-semibold">{result.exploratoryCount}</span> exploratory
        </span>
      </div>
    </div>
  )
}
