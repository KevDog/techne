'use client'

import { useCallback, useState, useTransition } from 'react'

export type AsyncState<T> =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; result: T }
  | { phase: 'error'; message: string }

export type AsyncMutation<T> = {
  state: AsyncState<T>
  run: (fn: () => Promise<T>) => void
  reset: () => void
}

export function useAsyncMutation<T>(errorMessage = 'Operation failed.'): AsyncMutation<T> {
  const [state, setState] = useState<AsyncState<T>>({ phase: 'idle' })
  const [, startTransition] = useTransition()

  const run = useCallback(
    (fn: () => Promise<T>) => {
      setState({ phase: 'loading' })
      startTransition(async () => {
        try {
          const result = await fn()
          setState({ phase: 'done', result })
        } catch {
          setState({ phase: 'error', message: errorMessage })
        }
      })
    },
    [errorMessage]
  )

  const reset = useCallback(() => setState({ phase: 'idle' }), [])

  return { state, run, reset }
}
