import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type {
  Department,
  Material,
  MaterialType,
  MaterialState,
} from '@/lib/types/domain'

export const getMaterialsByShow = cache(async (showId: string): Promise<Material[]> => {
  const supabase = await createSupabaseServerClient()
  const { data: depts } = await supabase
    .from('departments')
    .select('id')
    .eq('show_id', showId)
  const deptIds = (depts ?? []).map((d) => d.id)
  if (deptIds.length === 0) return []
  const { data, error } = await supabase
    .from('materials')
    .select('id, department_id, uploaded_by, type, state, title, description, url, storage_path, body, tags, created_at')
    .in('department_id', deptIds)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map((row) => ({
    id: row.id,
    departmentId: row.department_id,
    uploadedBy: row.uploaded_by,
    type: row.type as MaterialType,
    state: row.state as MaterialState,
    title: row.title,
    description: row.description,
    url: row.url,
    storagePath: row.storage_path,
    body: row.body,
    tags: row.tags ?? [],
    createdAt: row.created_at,
  }))
})

export type MaterialWithUrl = Material & { signedUrl: string | null }

export const getMaterialsByDepartment = cache(
  async (dept: Department): Promise<MaterialWithUrl[]> => {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('department_id', dept.id)
      .order('created_at', { ascending: false })

    if (error || !data) return []

    return Promise.all(
      data.map(async (row) => {
        const material: Material = {
          id: row.id,
          departmentId: row.department_id,
          uploadedBy: row.uploaded_by,
          type: row.type as MaterialType,
          state: row.state as MaterialState,
          title: row.title,
          description: row.description,
          url: row.url,
          storagePath: row.storage_path,
          body: row.body,
          tags: row.tags ?? [],
          createdAt: row.created_at,
        }

        let signedUrl: string | null = null
        if (
          row.storage_path &&
          (row.type === 'image' || row.type === 'file')
        ) {
          const { data: urlData } = await supabase.storage
            .from('materials')
            .createSignedUrl(row.storage_path, 3600)
          signedUrl = urlData?.signedUrl ?? null
        }

        return { ...material, signedUrl }
      })
    )
  }
)
