import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Material } from '@/lib/types/domain'

vi.mock('@/lib/actions/agents', () => ({
  suggestTags: vi.fn().mockResolvedValue({
    tags: ['act-1', 'warm-tones'],
    rationale: 'Tags reflect scene and mood.',
  }),
}))

const material: Material = {
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Lighting Plot',
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-06-14T00:00:00Z',
}

describe('TagSuggestionButton', () => {
  it('renders the suggest tags button', async () => {
    const { TagSuggestionButton } = await import('@/components/agents/TagSuggestionButton')
    render(
      <TagSuggestionButton
        material={material}
        showName="Hamlet"
        departmentName="Lighting Design"
        existingTags={[]}
        onAccept={vi.fn()}
      />
    )
    expect(screen.getByText(/Suggest tags/i)).toBeInTheDocument()
  })

  it('calls suggestTags and shows suggestions on click', async () => {
    const { TagSuggestionButton } = await import('@/components/agents/TagSuggestionButton')
    render(
      <TagSuggestionButton
        material={material}
        showName="Hamlet"
        departmentName="Lighting Design"
        existingTags={[]}
        onAccept={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Suggest tags/i))
    await waitFor(() => {
      expect(screen.getByText('act-1')).toBeInTheDocument()
      expect(screen.getByText('warm-tones')).toBeInTheDocument()
    })
  })

  it('calls onAccept with selected tags when Accept is clicked', async () => {
    const { TagSuggestionButton } = await import('@/components/agents/TagSuggestionButton')
    const onAccept = vi.fn()
    render(
      <TagSuggestionButton
        material={material}
        showName="Hamlet"
        departmentName="Lighting Design"
        existingTags={[]}
        onAccept={onAccept}
      />
    )
    fireEvent.click(screen.getByText(/Suggest tags/i))
    await waitFor(() => expect(screen.getByText('act-1')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Accept all/i))
    expect(onAccept).toHaveBeenCalledWith(['act-1', 'warm-tones'])
  })

  it('shows loading state while fetching', async () => {
    const { suggestTags } = await import('@/lib/actions/agents')
    vi.mocked(suggestTags).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ tags: [], rationale: '' }), 100))
    )
    const { TagSuggestionButton } = await import('@/components/agents/TagSuggestionButton')
    render(
      <TagSuggestionButton
        material={material}
        showName="Hamlet"
        departmentName="Lighting Design"
        existingTags={[]}
        onAccept={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Suggest tags/i))
    expect(screen.getByText(/Thinking/i)).toBeInTheDocument()
  })
})
