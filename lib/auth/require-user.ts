import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

export type AuthenticatedContext = {
  supabase: Supabase
  user: User
}

export async function requireUser(): Promise<AuthenticatedContext> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return { supabase, user }
}
