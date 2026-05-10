import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/actions/meetings', () => ({
  endMeeting: vi.fn().mockResolvedValue(undefined),
}))

describe('EndMeetingButton', () => {
  it('renders when canManage is true', async () => {
    const { EndMeetingButton } = await import('@/components/meetings/EndMeetingButton')
    render(<EndMeetingButton meetingId="meet-1" canManage={true} onEnd={vi.fn()} />)
    expect(screen.getByText(/End Meeting/i)).toBeInTheDocument()
  })

  it('renders nothing when canManage is false', async () => {
    const { EndMeetingButton } = await import('@/components/meetings/EndMeetingButton')
    const { container } = render(
      <EndMeetingButton meetingId="meet-1" canManage={false} onEnd={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })
})
