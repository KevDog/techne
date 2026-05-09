import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'

const mockSignInWithOtp = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
    },
  })),
}))

describe('LoginPage', () => {
  it('shows error message when signInWithOtp fails', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: { message: 'Rate limit exceeded' } })
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send magic link/i }))
    })
    expect(screen.getByRole('alert')).toHaveTextContent('Rate limit exceeded')
  })


  it('renders email input and submit button', async () => {
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    render(<LoginPage />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument()
  })

  it('submits email on form submit', async () => {
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /send magic link/i }))
    })
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: { emailRedirectTo: expect.stringContaining('/auth/callback') },
    })
  })
})
