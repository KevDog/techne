'use client'

import type { MaterialWithUrl } from '@/lib/data/materials'

type Props = {
  materials: MaterialWithUrl[]
  orgId: string
  showId: string
  deptId: string
  allowReopen: boolean
}

export function DepartmentClient(_props: Props) {
  return <div>Loading…</div>
}
