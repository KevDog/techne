import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Department, Material } from '@/lib/types/domain'
import { MaterialStateSchema, MaterialTypeSchema } from '@/lib/schemas/db-rows'

type MaterialRow = {
  id: string
  department_id: string
  uploaded_by: string
  type: string
  state: string
  title: string
  description: string | null
  url: string | null
  storage_path: string | null
  body: string | null
  tags: string[] | null
  created_at: string
}

function mapRow(row: MaterialRow): Material {
  return {
    id: row.id,
    departmentId: row.department_id,
    uploadedBy: row.uploaded_by,
    type: MaterialTypeSchema.parse(row.type),
    state: MaterialStateSchema.parse(row.state),
    title: row.title,
    description: row.description,
    url: row.url,
    storagePath: row.storage_path,
    body: row.body,
    tags: row.tags ?? [],
    createdAt: row.created_at,
  }
}

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
  return data.map(mapRow)
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
        const material = mapRow(row)
        let signedUrl: string | null = null
        if (row.storage_path && (material.type === 'image' || material.type === 'file')) {
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
