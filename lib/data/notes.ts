import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { NoteWithAuthors } from '@/lib/types/domain'

const NOTE_SELECT = 'id, body, tags, created_by, updated_by, created_at, updated_at, hidden_at, material_id, show_id, meeting_id'

type NoteRow = {
  id: string
  body: string
  tags: string[]
  created_by: string
  updated_by: string
  created_at: string
  updated_at: string
  hidden_at: string | null
  material_id: string | null
  show_id: string | null
  meeting_id: string | null
}

async function hydrateAuthors(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  rows: { created_by: string; updated_by: string }[]
): Promise<Record<string, string>> {
  if (rows.length === 0) return {}
  const userIds = [...new Set(rows.flatMap((r) => [r.created_by, r.updated_by]))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds)
  return Object.fromEntries((profiles ?? []).map((p) => [p.id, p.display_name ?? 'Unknown']))
}

function mapRow(row: NoteRow, nameMap: Record<string, string>): NoteWithAuthors {
  return {
    id: row.id,
    body: row.body,
    tags: row.tags ?? [],
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hiddenAt: row.hidden_at,
    materialId: row.material_id,
    showId: row.show_id,
    meetingId: row.meeting_id,
    createdByName: nameMap[row.created_by] ?? 'Unknown',
    updatedByName: nameMap[row.updated_by] ?? 'Unknown',
  }
}

export const getNotesByMaterial = cache(
  async (materialId: string): Promise<NoteWithAuthors[]> => {
    const supabase = await createSupabaseServerClient()
    const { data: rows, error } = await supabase
      .from('notes')
      .select(NOTE_SELECT)
      .eq('material_id', materialId)
      .order('created_at', { ascending: true })
    if (error || !rows || rows.length === 0) return []
    const nameMap = await hydrateAuthors(supabase, rows)
    return rows.map((r) => mapRow(r, nameMap))
  }
)

export const getNotesByMaterialIds = cache(
  async (materialIds: readonly string[]): Promise<Record<string, NoteWithAuthors[]>> => {
    if (materialIds.length === 0) return {}
    const supabase = await createSupabaseServerClient()
    const { data: rows, error } = await supabase
      .from('notes')
      .select(NOTE_SELECT)
      .in('material_id', materialIds as string[])
      .order('created_at', { ascending: true })
    if (error || !rows) return Object.fromEntries(materialIds.map((id) => [id, []]))

    const nameMap = await hydrateAuthors(supabase, rows)
    const grouped: Record<string, NoteWithAuthors[]> = Object.fromEntries(
      materialIds.map((id) => [id, []])
    )
    for (const row of rows) {
      if (!row.material_id) continue
      const note = mapRow(row, nameMap)
      const bucket = grouped[row.material_id]
      if (bucket) bucket.push(note)
    }
    return grouped
  }
)

export const getNotesByShow = cache(
  async (showId: string): Promise<NoteWithAuthors[]> => {
    const supabase = await createSupabaseServerClient()
    const { data: rows, error } = await supabase
      .from('notes')
      .select(NOTE_SELECT)
      .eq('show_id', showId)
      .order('created_at', { ascending: true })
    if (error || !rows || rows.length === 0) return []
    const nameMap = await hydrateAuthors(supabase, rows)
    return rows.map((r) => mapRow(r, nameMap))
  }
)

export const getNotesByMeeting = cache(
  async (meetingId: string): Promise<NoteWithAuthors[]> => {
    const supabase = await createSupabaseServerClient()
    const { data: rows, error } = await supabase
      .from('notes')
      .select(NOTE_SELECT)
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true })
    if (error || !rows || rows.length === 0) return []
    const nameMap = await hydrateAuthors(supabase, rows)
    return rows.map((r) => mapRow(r, nameMap))
  }
)
