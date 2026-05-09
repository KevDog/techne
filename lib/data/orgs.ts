import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Org } from '@/lib/types/domain'

export const getOrgBySlug = cache(async (slug: string): Promise<Org | null> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('orgs')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    settings: data.settings as Org['settings'],
    createdAt: data.created_at,
  }
})
