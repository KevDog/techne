import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Org } from '@/lib/types/domain'

export type ShowWithRelations = {
  id: string
  name: string
  slug: string
  orgId: string
  seasonId: string | null
  approvalMode: 'single' | 'multi'
  allowReopen: boolean
  createdAt: string
  season: { name: string; slug: string } | null
  departments: { id: string }[]
  show_members: {
    id: string
    featured: boolean
    profiles: { display_name: string | null } | null
    role_definitions: { name: string } | null
  }[]
}

export const getShowsByOrg = cache(async (org: Org): Promise<ShowWithRelations[]> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('shows')
    .select(`
      id, name, slug, org_id, season_id, approval_mode, allow_reopen, created_at,
      season:seasons ( name, slug ),
      departments ( id ),
      show_members ( id, featured, profiles ( display_name ), role_definitions ( name ) )
    `)
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    orgId: row.org_id,
    seasonId: row.season_id,
    approvalMode: row.approval_mode as 'single' | 'multi',
    allowReopen: row.allow_reopen,
    createdAt: row.created_at,
    season: Array.isArray(row.season) ? (row.season[0] ?? null) : (row.season ?? null),
    departments: (row.departments as { id: string }[]) ?? [],
    show_members: (row.show_members as ShowWithRelations['show_members']) ?? [],
  }))
})

// ShowDetail overrides departments from ShowWithRelations (which only has { id }) to include
// name, slug, and created_at for the detail view. getShowsByOrg callers should not cast to ShowDetail.
export type ShowDetail = Omit<ShowWithRelations, 'departments'> & {
  departments: { id: string; name: string; slug: string; created_at: string }[]
}

export const getShowBySlug = cache(async (org: Org, slug: string): Promise<ShowDetail | null> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('shows')
    .select(`
      id, name, slug, org_id, season_id, approval_mode, allow_reopen, created_at,
      season:seasons ( name, slug ),
      departments ( id, name, slug, created_at ),
      show_members ( id, featured, profiles ( display_name ), role_definitions ( name ) )
    `)
    .eq('org_id', org.id)
    .eq('slug', slug)
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    orgId: data.org_id,
    seasonId: data.season_id,
    approvalMode: data.approval_mode as 'single' | 'multi',
    allowReopen: data.allow_reopen,
    createdAt: data.created_at,
    season: Array.isArray(data.season) ? (data.season[0] ?? null) : (data.season ?? null),
    departments: (data.departments as ShowDetail['departments']) ?? [],
    show_members: (data.show_members as ShowWithRelations['show_members']) ?? [],
  }
})
