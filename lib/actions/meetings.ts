'use server'

import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth/require-user'
import { assertCanManageShow, assertShowMember } from '@/lib/auth/permissions'
import {
  MeetingTitleSchema,
  NoteBodySchema,
  ScheduledAtSchema,
  UuidSchema,
} from '@/lib/schemas/actions'

const uuidSchema = UuidSchema
const titleSchema = MeetingTitleSchema
const scheduledAtSchema = ScheduledAtSchema

export async function createMeeting(
  showId: string,
  title: string,
  scheduledAt: string
): Promise<{ id: string }> {
  uuidSchema.parse(showId)
  titleSchema.parse(title)
  scheduledAtSchema.parse(scheduledAt)

  const { supabase, user } = await requireUser()
  await assertCanManageShow(supabase, showId, user.id)

  const { data: row, error } = await supabase
    .from('meetings')
    .insert({ show_id: showId, title, scheduled_at: scheduledAt, created_by: user.id })
    .select('id')
    .single()
  if (error || !row) throw new Error('Operation failed')

  revalidatePath('', 'layout')
  return { id: row.id }
}

export async function startMeeting(meetingId: string): Promise<void> {
  uuidSchema.parse(meetingId)

  const { supabase, user } = await requireUser()

  const { data: meeting } = await supabase
    .from('meetings')
    .select('show_id')
    .eq('id', meetingId)
    .single()
  if (!meeting) throw new Error('Not found')

  await assertShowMember(supabase, meeting.show_id, user.id)

  const { error } = await supabase
    .from('meetings')
    .update({ started_at: new Date().toISOString() })
    .eq('id', meetingId)
    .is('started_at', null)
  if (error) throw new Error('Operation failed')

  revalidatePath('', 'layout')
}

export async function endMeeting(meetingId: string): Promise<void> {
  uuidSchema.parse(meetingId)

  const { supabase, user } = await requireUser()

  const { data: meeting } = await supabase
    .from('meetings')
    .select('show_id')
    .eq('id', meetingId)
    .single()
  if (!meeting) throw new Error('Not found')

  await assertCanManageShow(supabase, meeting.show_id, user.id)

  const { error } = await supabase
    .from('meetings')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', meetingId)
  if (error) throw new Error('Operation failed')

  revalidatePath('', 'layout')
}

export async function addMeetingNote(
  meetingId: string,
  body: string
): Promise<{ id: string }> {
  uuidSchema.parse(meetingId)
  NoteBodySchema.parse(body)

  const { supabase, user } = await requireUser()

  const { data: row, error } = await supabase
    .from('notes')
    .insert({ body, tags: [], created_by: user.id, updated_by: user.id, meeting_id: meetingId })
    .select('id')
    .single()
  if (error || !row) throw new Error('Operation failed')

  revalidatePath('', 'layout')
  return { id: row.id }
}

export async function hideMeetingNote(noteId: string): Promise<void> {
  uuidSchema.parse(noteId)

  const { supabase, user } = await requireUser()

  const { error } = await supabase
    .from('notes')
    .update({ hidden_at: new Date().toISOString() })
    .eq('id', noteId)
    .eq('created_by', user.id)
  if (error) throw new Error('Operation failed')
  revalidatePath('', 'layout')
}

export async function restoreMeetingNote(noteId: string): Promise<void> {
  uuidSchema.parse(noteId)

  const { supabase, user } = await requireUser()

  const { error } = await supabase
    .from('notes')
    .update({ hidden_at: null })
    .eq('id', noteId)
    .eq('created_by', user.id)
  if (error) throw new Error('Operation failed')
  revalidatePath('', 'layout')
}
