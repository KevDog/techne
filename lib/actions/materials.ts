'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { MaterialTagsSchema } from '@/lib/schemas/actions'
import type { MaterialType, MaterialState } from '@/lib/types/domain'
import { isValidTransition } from '@/lib/utils/material-transitions'

const URL_TYPES: ReadonlySet<MaterialType> = new Set(['link', 'image'])

function validateHttpUrl(url: string): string {
  const parsed = z.string().url().safeParse(url)
  if (!parsed.success) throw new Error('Invalid URL')
  const protocol = new URL(parsed.data).protocol
  if (protocol !== 'https:' && protocol !== 'http:') throw new Error('Invalid URL')
  return parsed.data
}

export async function createMaterial(
  deptId: string,
  type: MaterialType,
  data: {
    title: string
    description?: string
    url?: string
    storagePath?: string
    body?: string
    tags?: string[]
  }
): Promise<{ id: string }> {
  if (URL_TYPES.has(type) && data.url) {
    data = { ...data, url: validateHttpUrl(data.url) }
  }

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: row, error } = await supabase
    .from('materials')
    .insert({
      department_id: deptId,
      uploaded_by: user.id,
      type,
      title: data.title,
      description: data.description ?? null,
      url: data.url ?? null,
      storage_path: data.storagePath ?? null,
      body: data.body ?? null,
      tags: data.tags ?? [],
    })
    .select('id')
    .single()
  if (error || !row) throw new Error(error?.message ?? 'Insert failed')

  revalidatePath('', 'layout')
  return { id: row.id }
}

export async function transitionState(
  materialId: string,
  targetState: MaterialState
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: material, error: mErr } = await supabase
    .from('materials')
    .select('state, department_id')
    .eq('id', materialId)
    .single()
  if (mErr || !material) throw new Error('Material not found')

  const { data: dept, error: dErr } = await supabase
    .from('departments')
    .select('show_id, shows!inner(allow_reopen)')
    .eq('id', material.department_id)
    .single()
  if (dErr || !dept) throw new Error('Department not found')

  const allowReopen = (dept.shows as { allow_reopen: boolean }).allow_reopen

  if (!isValidTransition(material.state as MaterialState, targetState, allowReopen)) {
    throw new Error(`Invalid state transition: ${material.state} → ${targetState}`)
  }

  const { error } = await supabase
    .from('materials')
    .update({ state: targetState })
    .eq('id', materialId)
  if (error) throw new Error(error.message)

  revalidatePath('', 'layout')
}

export async function updateTags(
  materialId: string,
  tags: string[]
): Promise<void> {
  const parsed = MaterialTagsSchema.safeParse(tags)
  if (!parsed.success) throw new Error('Invalid tags')

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { error } = await supabase
    .from('materials')
    .update({ tags: parsed.data })
    .eq('id', materialId)
  if (error) throw new Error(error.message)
  revalidatePath('', 'layout')
}

export async function deleteMaterial(materialId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: material, error: mErr } = await supabase
    .from('materials')
    .select('storage_path, uploaded_by')
    .eq('id', materialId)
    .single()
  if (mErr || !material) throw new Error('Material not found')
  if (material.uploaded_by !== user.id) throw new Error('Unauthorized')

  if (material.storage_path) {
    const { error: storageError } = await supabase.storage
      .from('materials')
      .remove([material.storage_path])
    if (storageError) throw new Error(storageError.message)
  }

  const { error } = await supabase.from('materials').delete().eq('id', materialId)
  if (error) throw new Error(error.message)

  revalidatePath('', 'layout')
}
