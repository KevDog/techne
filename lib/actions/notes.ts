'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/types/db'

const noteIdSchema = z.string().uuid()
const noteBodySchema = z.string().min(1).max(10000)
const noteTagsSchema = z.array(z.string().max(50)).optional()

type NotesInsert = Database['public']['Tables']['notes']['Insert']

export type Attachment = { materialId: string } | { showId: string }

export async function createNote(
  attachment: Attachment,
  data: { body: string; tags?: string[] }
): Promise<{ id: string }> {
  noteBodySchema.parse(data.body)
  noteTagsSchema.parse(data.tags)

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const insert: NotesInsert = {
    body: data.body,
    tags: data.tags ?? [],
    created_by: user.id,
    updated_by: user.id,
    material_id: 'materialId' in attachment ? attachment.materialId : undefined,
    show_id: 'showId' in attachment ? attachment.showId : undefined,
  }

  const { data: row, error } = await supabase
    .from('notes')
    .insert(insert)
    .select('id')
    .single()
  if (error || !row) throw new Error('Operation failed')

  revalidatePath('', 'layout')
  return { id: row.id }
}

export async function updateNote(
  noteId: string,
  data: { body: string; tags?: string[] }
): Promise<void> {
  noteIdSchema.parse(noteId)
  noteBodySchema.parse(data.body)
  noteTagsSchema.parse(data.tags)

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
  if (error) throw new Error('Operation failed')
  revalidatePath('', 'layout')
}

export async function hideNote(noteId: string): Promise<void> {
  noteIdSchema.parse(noteId)

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('notes')
    .update({ hidden_at: new Date().toISOString() })
    .eq('id', noteId)
  if (error) throw new Error('Operation failed')
  revalidatePath('', 'layout')
}

export async function restoreNote(noteId: string): Promise<void> {
  noteIdSchema.parse(noteId)

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('notes')
    .update({ hidden_at: null })
    .eq('id', noteId)
  if (error) throw new Error('Operation failed')
  revalidatePath('', 'layout')
}
