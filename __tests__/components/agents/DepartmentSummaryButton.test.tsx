import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Material } from '@/lib/types/domain'

vi.mock('@/lib/actions/agents', () => ({
  summarizeDepartment: vi.fn().mockResolvedValue({
    department: 'Lighting Design',
    summary: 'The team has decided on a dark, atmospheric look for the show.',
    decidedCount: 3,
    proposedCount: 2,
    exploratoryCount: 1,
  }),
}))

const material: Material = {
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'decided',
  title: 'Final Plot',
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-06-14T00:00:00Z',
}

describe('DepartmentSummaryButton', () => {
  it('renders the summary button', async () => {
    const { DepartmentSummaryButton } = await import('@/components/agents/DepartmentSummaryButton')
    render(
      <DepartmentSummaryButton
        materials={[material]}
        showName="Hamlet"
        departmentName="Lighting Design"
      />
    )
    expect(screen.getByText(/Where we've landed/i)).toBeInTheDocument()
  })

  it('calls summarizeDepartment and shows summary on click', async () => {
    const { DepartmentSummaryButton } = await import('@/components/agents/DepartmentSummaryButton')
    render(
      <DepartmentSummaryButton
        materials={[material]}
        showName="Hamlet"
        departmentName="Lighting Design"
      />
    )
    fireEvent.click(screen.getByText(/Where we've landed/i))
    await waitFor(() => {
      expect(screen.getByText(/dark, atmospheric look/i)).toBeInTheDocument()
    })
  })

  it('shows decided/proposed/exploratory counts after summary', async () => {
    const { DepartmentSummaryButton } = await import('@/components/agents/DepartmentSummaryButton')
    render(
      <DepartmentSummaryButton
        materials={[material]}
        showName="Hamlet"
        departmentName="Lighting Design"
      />
    )
    fireEvent.click(screen.getByText(/Where we've landed/i))
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('shows loading state while fetching', async () => {
    const { summarizeDepartment } = await import('@/lib/actions/agents')
    vi.mocked(summarizeDepartment).mockImplementationOnce(
      () => new Promise((resolve) =>
        setTimeout(() => resolve({
          department: 'Lighting Design',
          summary: '',
          decidedCount: 0,
          proposedCount: 0,
          exploratoryCount: 0,
        }), 100)
      )
    )
    const { DepartmentSummaryButton } = await import('@/components/agents/DepartmentSummaryButton')
    render(
      <DepartmentSummaryButton
        materials={[material]}
        showName="Hamlet"
        departmentName="Lighting Design"
      />
    )
    fireEvent.click(screen.getByText(/Where we've landed/i))
    expect(screen.getByText(/Summarizing/i)).toBeInTheDocument()
  })

  it('can be dismissed after showing summary', async () => {
    const { DepartmentSummaryButton } = await import('@/components/agents/DepartmentSummaryButton')
    render(
      <DepartmentSummaryButton
        materials={[material]}
        showName="Hamlet"
        departmentName="Lighting Design"
      />
    )
    fireEvent.click(screen.getByText(/Where we've landed/i))
    await waitFor(() => expect(screen.getByText(/dark, atmospheric look/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Dismiss/i))
    expect(screen.queryByText(/dark, atmospheric look/i)).not.toBeInTheDocument()
  })
})
