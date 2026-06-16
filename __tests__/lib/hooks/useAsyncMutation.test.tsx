import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useAsyncMutation } from '@/lib/hooks/useAsyncMutation'

describe('useAsyncMutation', () => {
  it('starts in idle phase', () => {
    const { result } = renderHook(() => useAsyncMutation<string>())
    expect(result.current.state).toEqual({ phase: 'idle' })
  })

  it('transitions through loading to done on success', async () => {
    const { result } = renderHook(() => useAsyncMutation<string>())
    act(() => {
      result.current.run(() => Promise.resolve('hello'))
    })
    await waitFor(() => {
      expect(result.current.state).toEqual({ phase: 'done', result: 'hello' })
    })
  })

  it('transitions to error on rejection with default message', async () => {
    const { result } = renderHook(() => useAsyncMutation<string>())
    act(() => {
      result.current.run(() => Promise.reject(new Error('boom')))
    })
    await waitFor(() => {
      expect(result.current.state).toEqual({ phase: 'error', message: 'Operation failed.' })
    })
  })

  it('uses custom error message when provided', async () => {
    const { result } = renderHook(() => useAsyncMutation<string>('Custom error.'))
    act(() => {
      result.current.run(() => Promise.reject(new Error('boom')))
    })
    await waitFor(() => {
      expect(result.current.state).toEqual({ phase: 'error', message: 'Custom error.' })
    })
  })

  it('reset returns state to idle', async () => {
    const { result } = renderHook(() => useAsyncMutation<string>())
    act(() => {
      result.current.run(() => Promise.resolve('x'))
    })
    await waitFor(() => expect(result.current.state.phase).toBe('done'))
    act(() => {
      result.current.reset()
    })
    expect(result.current.state).toEqual({ phase: 'idle' })
  })
})
