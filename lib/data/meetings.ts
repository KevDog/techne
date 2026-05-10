import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Meeting } from '@/lib/types/domain'

const MEETING_SELECT =
  'id, show_id, title, scheduled_at, started_at, ended_at, created_by, created_at'

function mapRow(row: {
  id: string; show_id: string; title: string
  scheduled_at: string; started_at: string | null; ended_at: string | null
  created_by: string; created_at: string
}): Meeting {
  return {
    id: row.id,
    showId: row.show_id,
    title: row.title,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export const getMeetingsByShow = cache(async (showId: string): Promise<Meeting[]> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .eq('show_id', showId)
    .order('scheduled_at', { ascending: true })
  if (error || !data) return []
  return data.map(mapRow)
})

export const getMeetingById = cache(async (meetingId: string): Promise<Meeting | null> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .eq('id', meetingId)
    .single()
  if (error || !data) return null
  return mapRow(data)
})
