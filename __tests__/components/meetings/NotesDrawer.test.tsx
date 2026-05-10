import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { NoteWithAuthors } from '@/lib/types/domain'

vi.mock('@/lib/actions/meetings', () => ({
  addMeetingNote: vi.fn().mockResolvedValue({ id: 'note-new' }),
  hideMeetingNote: vi.fn().mockResolvedValue(undefined),
  restoreMeetingNote: vi.fn().mockResolvedValue(undefined),
}))

const makeNote = (overrides: Partial<NoteWithAuthors> = {}): NoteWithAuthors => ({
  id: 'note-1', body: 'Test note', tags: [], createdBy: 'u1', updatedBy: 'u1',
  createdAt: '2026-05-09T00:00:00Z', updatedAt: '2026-05-09T00:00:00Z',
  hiddenAt: null, materialId: null, showId: null, meetingId: 'meet-1',
  createdByName: 'Sarah', updatedByName: 'Sarah',
  ...overrides,
})

describe('NotesDrawer', () => {
  it('is collapsed by default — notes not visible', async () => {
    const { NotesDrawer } = await import('@/components/meetings/NotesDrawer')
    render(<NotesDrawer meetingId="meet-1" notes={[makeNote()]} />)
    expect(screen.queryByText('Test note')).not.toBeInTheDocument()
  })

  it('expands when toggle button clicked', async () => {
    const { NotesDrawer } = await import('@/components/meetings/NotesDrawer')
    render(<NotesDrawer meetingId="meet-1" notes={[makeNote()]} />)
    fireEvent.click(screen.getByText(/Notes/i))
    expect(screen.getByText('Test note')).toBeInTheDocument()
  })

  it('shows note composer when expanded', async () => {
    const { NotesDrawer } = await import('@/components/meetings/NotesDrawer')
    render(<NotesDrawer meetingId="meet-1" notes={[]} />)
    fireEvent.click(screen.getByText(/Notes/i))
    expect(screen.getByPlaceholderText(/Add a note/i)).toBeInTheDocument()
  })
})
