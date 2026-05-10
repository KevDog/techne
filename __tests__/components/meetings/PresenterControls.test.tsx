import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

describe('PresenterControls', () => {
  it('shows "Claim presenter" when no presenter', async () => {
    const { PresenterControls } = await import('@/components/meetings/PresenterControls')
    render(
      <PresenterControls
        presenterId={null}
        presenterRequest={null}
        selfUserId="u1"
        onClaim={vi.fn()}
        onRequest={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText(/Claim presenter/i)).toBeInTheDocument()
  })

  it('shows "Release" when self is presenter', async () => {
    const { PresenterControls } = await import('@/components/meetings/PresenterControls')
    render(
      <PresenterControls
        presenterId="u1"
        presenterRequest={null}
        selfUserId="u1"
        onClaim={vi.fn()}
        onRequest={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText(/Release/i)).toBeInTheDocument()
  })

  it('shows "Request presenter" when someone else is presenter', async () => {
    const { PresenterControls } = await import('@/components/meetings/PresenterControls')
    render(
      <PresenterControls
        presenterId="u2"
        presenterRequest={null}
        selfUserId="u1"
        onClaim={vi.fn()}
        onRequest={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText(/Request presenter/i)).toBeInTheDocument()
  })

  it('disables "Request presenter" when a request is already pending', async () => {
    const { PresenterControls } = await import('@/components/meetings/PresenterControls')
    render(
      <PresenterControls
        presenterId="u2"
        presenterRequest={{ from_user_id: 'u3', requested_at: 1 }}
        selfUserId="u1"
        onClaim={vi.fn()}
        onRequest={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText(/Request presenter/i).closest('button')).toBeDisabled()
  })

  it('calls onClaim when claim button clicked', async () => {
    const { PresenterControls } = await import('@/components/meetings/PresenterControls')
    const onClaim = vi.fn()
    render(
      <PresenterControls
        presenterId={null}
        presenterRequest={null}
        selfUserId="u1"
        onClaim={onClaim}
        onRequest={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Claim presenter/i))
    expect(onClaim).toHaveBeenCalled()
  })
})
