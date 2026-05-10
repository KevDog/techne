'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export type Attachment = { materialId: string } | { showId: string }

export async function createNote(
  attachment: Attachment,
  data: { body: string; tags?: string[] }
): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const insert = {
    body: data.body,
    tags: data.tags ?? [],
    created_by: user.id,
    updated_by: user.id,
    ...('materialId' in attachment
      ? { material_id: attachment.materialId }
      : { show_id: attachment.showId }),
  }

  const { data: row, error } = await supabase
    .from('notes')
    .insert(insert)
    .select('id')
    .single()
  if (error || !row) throw new Error(error?.message ?? 'Insert failed')

  revalidatePath('', 'layout')
  return { id: row.id }
}

export async function updateNote(
  noteId: string,
  data: { body: string; tags?: string[] }
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('notes')
    .update({
      body: data.body,
      tags: data.tags ?? [],
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', noteId)
  if (error) throw new Error(error.message)
  revalidatePath('', 'layout')
}

export async function hideNote(noteId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('notes')
    .update({ hidden_at: new Date().toISOString() })
    .eq('id', noteId)
  if (error) throw new Error(error.message)
  revalidatePath('', 'layout')
}

export async function restoreNote(noteId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('notes')
    .update({ hidden_at: null })
    .eq('id', noteId)
  if (error) throw new Error(error.message)
  revalidatePath('', 'layout')
}
