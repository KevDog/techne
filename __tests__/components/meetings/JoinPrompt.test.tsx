import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

describe('JoinPrompt', () => {
  it('renders both join options', async () => {
    const { JoinPrompt } = await import('@/components/meetings/JoinPrompt')
    render(<JoinPrompt onJoin={vi.fn()} />)
    expect(screen.getByText(/Join as viewer/i)).toBeInTheDocument()
    expect(screen.getByText(/Browse freely/i)).toBeInTheDocument()
  })

  it('calls onJoin with "follow" when viewer button clicked', async () => {
    const { JoinPrompt } = await import('@/components/meetings/JoinPrompt')
    const onJoin = vi.fn()
    render(<JoinPrompt onJoin={onJoin} />)
    fireEvent.click(screen.getByText(/Join as viewer/i))
    expect(onJoin).toHaveBeenCalledWith('follow')
  })

  it('calls onJoin with "browse" when browse button clicked', async () => {
    const { JoinPrompt } = await import('@/components/meetings/JoinPrompt')
    const onJoin = vi.fn()
    render(<JoinPrompt onJoin={onJoin} />)
    fireEvent.click(screen.getByText(/Browse freely/i))
    expect(onJoin).toHaveBeenCalledWith('browse')
  })
})
