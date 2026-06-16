import { cache } from 'react'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  ApprovalModeSchema,
  ShowDepartmentDetailSchema,
  ShowDepartmentRefSchema,
  ShowMemberSchema,
  parseSeason,
} from '@/lib/schemas/db-rows'
import type { Org } from '@/lib/types/domain'

const DeptRefsSchema = z.array(ShowDepartmentRefSchema).catch([])
const DeptDetailsSchema = z.array(ShowDepartmentDetailSchema).catch([])
const ShowMembersSchema = z.array(ShowMemberSchema).catch([])

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
  show_members: z.infer<typeof ShowMembersSchema>
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
    approvalMode: ApprovalModeSchema.parse(row.approval_mode),
    allowReopen: row.allow_reopen,
    createdAt: row.created_at,
    season: parseSeason(row.season),
    departments: DeptRefsSchema.parse(row.departments ?? []),
    show_members: ShowMembersSchema.parse(row.show_members ?? []),
  }))
})

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
    approvalMode: ApprovalModeSchema.parse(data.approval_mode),
    allowReopen: data.allow_reopen,
    createdAt: data.created_at,
    season: parseSeason(data.season),
    departments: DeptDetailsSchema.parse(data.departments ?? []),
    show_members: ShowMembersSchema.parse(data.show_members ?? []),
  }
})
