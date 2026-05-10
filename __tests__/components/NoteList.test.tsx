import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { NoteWithAuthors } from '@/lib/types/domain'

vi.mock('@/lib/actions/notes', () => ({
  createNote: vi.fn().mockResolvedValue({ id: 'new-note' }),
  updateNote: vi.fn().mockResolvedValue(undefined),
  hideNote: vi.fn().mockResolvedValue(undefined),
  restoreNote: vi.fn().mockResolvedValue(undefined),
}))

const makeNote = (overrides: Partial<NoteWithAuthors> = {}): NoteWithAuthors => ({
  id: 'note-1',
  body: 'This is a **bold** note.',
  tags: ['design', 'act-2'],
  createdBy: 'user-1',
  updatedBy: 'user-1',
  createdAt: '2026-05-09T10:00:00Z',
  updatedAt: '2026-05-09T10:00:00Z',
  hiddenAt: null,
  materialId: 'mat-1',
  showId: null,
  meetingId: null,
  createdByName: 'Sarah M',
  updatedByName: 'Sarah M',
  ...overrides,
})

describe('NoteList', () => {
  it('renders note body as markdown', async () => {
    const { NoteList } = await import('@/components/NoteList')
    render(<NoteList notes={[makeNote()]} attachment={{ materialId: 'mat-1' }} />)
    expect(screen.getByRole('strong')).toHaveTextContent('bold')
  })

  it('renders note tags', async () => {
    const { NoteList } = await import('@/components/NoteList')
    render(<NoteList notes={[makeNote()]} attachment={{ materialId: 'mat-1' }} />)
    expect(screen.getByText('design')).toBeInTheDocument()
    expect(screen.getByText('act-2')).toBeInTheDocument()
  })

  it('renders author name', async () => {
    const { NoteList } = await import('@/components/NoteList')
    render(<NoteList notes={[makeNote()]} attachment={{ materialId: 'mat-1' }} />)
    expect(screen.getByText(/Sarah M/)).toBeInTheDocument()
  })

  it('hides hidden notes by default', async () => {
    const { NoteList } = await import('@/components/NoteList')
    const hidden = makeNote({ id: 'note-2', hiddenAt: '2026-05-09T12:00:00Z', body: 'Hidden content' })
    const visible = makeNote({ id: 'note-1', body: 'Visible content' })
    render(<NoteList notes={[visible, hidden]} attachment={{ materialId: 'mat-1' }} />)
    expect(screen.getByText('Visible content')).toBeInTheDocument()
    expect(screen.queryByText('Hidden content')).not.toBeInTheDocument()
  })

  it('shows "Show hidden (N)" toggle when hidden notes exist', async () => {
    const { NoteList } = await import('@/components/NoteList')
    const hidden = makeNote({ hiddenAt: '2026-05-09T12:00:00Z' })
    render(<NoteList notes={[hidden]} attachment={{ materialId: 'mat-1' }} />)
    expect(screen.getByText('Show hidden (1)')).toBeInTheDocument()
  })

  it('reveals hidden notes when toggle is clicked', async () => {
    const { NoteList } = await import('@/components/NoteList')
    const hidden = makeNote({ hiddenAt: '2026-05-09T12:00:00Z', body: 'Hidden content' })
    render(<NoteList notes={[hidden]} attachment={{ materialId: 'mat-1' }} />)
    fireEvent.click(screen.getByText('Show hidden (1)'))
    expect(screen.getByText('Hidden content')).toBeInTheDocument()
  })

  it('renders Add note composer', async () => {
    const { NoteList } = await import('@/components/NoteList')
    render(<NoteList notes={[]} attachment={{ materialId: 'mat-1' }} />)
    expect(screen.getByPlaceholderText(/Add a note/)).toBeInTheDocument()
  })
})
