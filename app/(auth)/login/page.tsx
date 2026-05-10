'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

function LoginError() {
  const params = useSearchParams()
  const error = params?.get('error')
  if (!error) return null
  return (
    <p role="alert" className="text-red-400 text-sm">
      {error === 'auth_failed' ? 'Authentication failed. Please try again.' : error}
    </p>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const supabase = createSupabaseBrowserClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setErrorMessage(error.message)
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return <p>Check your email for a magic link.</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Suspense>
        <LoginError />
      </Suspense>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      <button type="submit">Send magic link</button>
    </form>
  )
}
