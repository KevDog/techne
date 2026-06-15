import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Material } from '@/lib/types/domain'

vi.mock('@/lib/actions/agents', () => ({
  searchWithSummary: vi.fn().mockResolvedValue({
    hits: [
      {
        materialId: 'm-1',
        title: 'Lighting Plot',
        department: 'Lighting Design',
        state: 'proposed',
        snippet: 'Dark atmospheric look',
      },
    ],
    summary: 'The team is pursuing a dark moody aesthetic.',
  }),
}))

const material: Material = {
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'proposed',
  title: 'Lighting Plot',
  description: 'Dark atmospheric look',
  url: null,
  storagePath: null,
  body: null,
  tags: ['dark'],
  createdAt: '2026-06-14T00:00:00Z',
}

describe('SearchBar', () => {
  it('renders a search input', async () => {
    const { SearchBar } = await import('@/components/agents/SearchBar')
    render(
      <SearchBar
        materials={[material]}
        showName="Hamlet"
        departmentNameById={{ 'dept-1': 'Lighting Design' }}
      />
    )
    expect(screen.getByPlaceholderText(/Search materials/i)).toBeInTheDocument()
  })

  it('calls searchWithSummary and shows results after submission', async () => {
    const { SearchBar } = await import('@/components/agents/SearchBar')
    render(
      <SearchBar
        materials={[material]}
        showName="Hamlet"
        departmentNameById={{ 'dept-1': 'Lighting Design' }}
      />
    )
    const input = screen.getByPlaceholderText(/Search materials/i)
    fireEvent.change(input, { target: { value: 'dark' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(screen.getByText('Lighting Plot')).toBeInTheDocument()
      expect(screen.getByText(/dark moody aesthetic/i)).toBeInTheDocument()
    })
  })

  it('shows hit count after search', async () => {
    const { SearchBar } = await import('@/components/agents/SearchBar')
    render(
      <SearchBar
        materials={[material]}
        showName="Hamlet"
        departmentNameById={{ 'dept-1': 'Lighting Design' }}
      />
    )
    const input = screen.getByPlaceholderText(/Search materials/i)
    fireEvent.change(input, { target: { value: 'dark' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/1 result/i)).toBeInTheDocument()
    })
  })

  it('clears results when input is cleared', async () => {
    const { SearchBar } = await import('@/components/agents/SearchBar')
    render(
      <SearchBar
        materials={[material]}
        showName="Hamlet"
        departmentNameById={{ 'dept-1': 'Lighting Design' }}
      />
    )
    const input = screen.getByPlaceholderText(/Search materials/i)
    fireEvent.change(input, { target: { value: 'dark' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(screen.getByText('Lighting Plot')).toBeInTheDocument())
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.queryByText('Lighting Plot')).not.toBeInTheDocument()
  })
})
