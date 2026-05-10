import type { Material } from '@/lib/types/domain'
import type { LBFilters } from '@/lib/liveblocks.config'

export function filterMaterials(materials: Material[], filters: LBFilters): Material[] {
  return materials.filter((m) => {
    if (filters.department_ids.length > 0 && !filters.department_ids.includes(m.departmentId)) return false
    if (filters.states.length > 0 && !filters.states.includes(m.state)) return false
    if (filters.tags.length > 0 && !filters.tags.some((t) => m.tags.includes(t))) return false
    return true
  })
}
