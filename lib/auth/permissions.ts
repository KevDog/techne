import { createSupabaseServerClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

export async function assertShowMember(supabase: Supabase, showId: string, userId: string) {
  const { data } = await supabase
    .from('show_members')
    .select('id')
    .eq('show_id', showId)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) throw new Error('Forbidden')
}

export async function assertCanManageShow(supabase: Supabase, showId: string, userId: string) {
  const { data } = await supabase
    .from('show_members')
    .select('role_definitions ( permissions )')
    .eq('show_id', showId)
    .eq('user_id', userId)
    .single()
  const permissions = (data?.role_definitions as { permissions: string[] } | null)?.permissions ?? []
  if (!permissions.includes('can_manage_show')) throw new Error('Forbidden')
}
