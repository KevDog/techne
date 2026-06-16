'use client'

import { summarizeDepartment } from '@/lib/actions/agents'
import { useAsyncMutation } from '@/lib/hooks/useAsyncMutation'
import type { AgentSummaryResult, Material } from '@/lib/types/domain'

type Props = {
  materials: Material[]
  showName: string
  departmentName: string
}

export function DepartmentSummaryButton({
  materials,
  showName,
  departmentName,
}: Props): React.ReactElement {
  const { state, run, reset } = useAsyncMutation<AgentSummaryResult>('Failed to generate summary.')

  function handleSummarize(): void {
    run(() => summarizeDepartment(materials, showName, departmentName))
  }

  if (state.phase === 'idle') {
    return (
      <button
        onClick={handleSummarize}
        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 border border-purple-800 hover:border-purple-600 rounded px-2 py-1 transition-colors"
      >
        <span>✦</span>
        Where we&apos;ve landed
      </button>
    )
  }

  if (state.phase === 'loading') {
    return (
      <span className="text-xs text-purple-400 animate-pulse" aria-live="polite" aria-busy="true">
        Summarizing…
      </span>
    )
  }

  if (state.phase === 'error') {
    return (
      <span className="text-xs text-red-400" role="alert">
        {state.message}{' '}
        <button onClick={reset} className="underline">
          retry
        </button>
      </span>
    )
  }

  const { result } = state
  return (
    <div className="bg-purple-950/30 border border-purple-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-purple-400 uppercase tracking-wider">
          ✦ Where we&apos;ve landed — {departmentName}
        </p>
        <button
          onClick={reset}
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
