import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Show, Department } from '@/lib/types/domain'

export const getDepartmentBySlug = cache(
  async (show: Show, slug: string): Promise<Department | null> => {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('departments')
      .select('id, show_id, name, slug, created_at')
      .eq('show_id', show.id)
      .eq('slug', slug)
      .single()
    if (error || !data) return null
    return {
      id: data.id,
      showId: data.show_id,
      name: data.name,
      slug: data.slug,
      createdAt: data.created_at,
    }
  }
)
