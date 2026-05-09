import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetOrgBySlug = vi.fn()
const mockNotFound = vi.fn()

vi.mock('@/lib/data/orgs', () => ({ getOrgBySlug: mockGetOrgBySlug }))
vi.mock('next/navigation', () => ({ notFound: mockNotFound }))

describe('OrgLayout', () => {
  it('renders children when org is found', async () => {
    mockGetOrgBySlug.mockResolvedValue({
      id: '1', name: 'State U Theater', slug: 'state-u-theater',
      settings: { claudeEnabled: false }, createdAt: '2026-01-01',
    })
    const { default: OrgLayout } = await import('@/app/(app)/[orgSlug]/layout')
    const jsx = await OrgLayout({
      children: <div>child content</div>,
      params: Promise.resolve({ orgSlug: 'state-u-theater' }),
    })
    render(jsx)
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('calls notFound when org does not exist', async () => {
    mockGetOrgBySlug.mockResolvedValue(null)
    const { default: OrgLayout } = await import('@/app/(app)/[orgSlug]/layout')
    mockNotFound.mockImplementation(() => { throw new Error('NOT_FOUND') })
    await expect(
      OrgLayout({
        children: <div />,
        params: Promise.resolve({ orgSlug: 'missing' }),
      })
    ).rejects.toThrow('NOT_FOUND')
  })
})
