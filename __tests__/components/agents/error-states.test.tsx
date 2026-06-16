import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { Material } from '@/lib/types/domain'

vi.mock('@/lib/actions/agents', () => ({
  suggestTags: vi.fn(),
  summarizeDepartment: vi.fn(),
  searchWithSummary: vi.fn(),
}))

const material: Material = {
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Plot',
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-06-14T00:00:00Z',
}

describe('agent component error states', () => {
  it('TagSuggestionButton shows error message and recovers via dismiss', async () => {
    const { suggestTags } = await import('@/lib/actions/agents')
    vi.mocked(suggestTags).mockRejectedValueOnce(new Error('Unauthorized'))

    const { TagSuggestionButton } = await import('@/components/agents/TagSuggestionButton')
    render(
      <TagSuggestionButton
        material={material}
        showName="Hamlet"
        departmentName="Lighting"
        existingTags={[]}
        onAccept={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText(/Suggest tags/i))

    await waitFor(() => {
      expect(screen.getByText(/Failed to get suggestions/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/dismiss/i))
    expect(screen.getByText(/Suggest tags/i)).toBeInTheDocument()
  })

  it('DepartmentSummaryButton shows error message and recovers via retry', async () => {
    const { summarizeDepartment } = await import('@/lib/actions/agents')
    vi.mocked(summarizeDepartment).mockRejectedValueOnce(new Error('Rate limit'))

    const { DepartmentSummaryButton } = await import('@/components/agents/DepartmentSummaryButton')
    render(
      <DepartmentSummaryButton
        materials={[material]}
        showName="Hamlet"
        departmentName="Lighting"
      />
    )

    fireEvent.click(screen.getByText(/Where we've landed/i))

    await waitFor(() => {
      expect(screen.getByText(/Failed to generate summary/i)).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText(/retry/i))
    expect(screen.getByText(/Where we've landed/i)).toBeInTheDocument()
  })

  it('SearchBar shows error message on action failure', async () => {
    const { searchWithSummary } = await import('@/lib/actions/agents')
    vi.mocked(searchWithSummary).mockRejectedValueOnce(new Error('boom'))

    const { SearchBar } = await import('@/components/agents/SearchBar')
    render(<SearchBar materials={[material]} showName="Hamlet" departmentNameById={{ 'dept-1': 'Lighting' }} />)

    const input = screen.getByPlaceholderText(/Search materials/i)
    fireEvent.change(input, { target: { value: 'storm' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => {
      expect(screen.getByText(/Search failed/i)).toBeInTheDocument()
    })
  })
})
