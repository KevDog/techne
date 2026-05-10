import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Material } from '@/lib/types/domain'

const mat = (id: string): Material => ({
  id,
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: `Material ${id}`,
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
})

describe('Filmstrip', () => {
  it('renders thumbnails for each material', async () => {
    const { Filmstrip } = await import('@/components/meetings/Filmstrip')
    render(
      <Filmstrip
        materials={[mat('a'), mat('b')]}
        activeMaterialIds={[]}
        onToggle={vi.fn()}
        onFilterChange={vi.fn()}
        filters={{ department_ids: [], tags: [], states: [] }}
        departments={[]}
      />
    )
    expect(screen.getByText('Material a')).toBeInTheDocument()
    expect(screen.getByText('Material b')).toBeInTheDocument()
  })

  it('calls onToggle with material id when thumbnail clicked', async () => {
    const { Filmstrip } = await import('@/components/meetings/Filmstrip')
    const onToggle = vi.fn()
    render(
      <Filmstrip
        materials={[mat('a')]}
        activeMaterialIds={[]}
        onToggle={onToggle}
        onFilterChange={vi.fn()}
        filters={{ department_ids: [], tags: [], states: [] }}
        departments={[]}
      />
    )
    fireEvent.click(screen.getByText('Material a'))
    expect(onToggle).toHaveBeenCalledWith('a')
  })

  it('highlights active materials', async () => {
    const { Filmstrip } = await import('@/components/meetings/Filmstrip')
    const { container } = render(
      <Filmstrip
        materials={[mat('a'), mat('b')]}
        activeMaterialIds={['a']}
        onToggle={vi.fn()}
        onFilterChange={vi.fn()}
        filters={{ department_ids: [], tags: [], states: [] }}
        departments={[]}
      />
    )
    const items = container.querySelectorAll('[data-active]')
    expect(items).toHaveLength(1)
  })
})
