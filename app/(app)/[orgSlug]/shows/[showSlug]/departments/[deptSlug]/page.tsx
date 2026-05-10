import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrgBySlug } from '@/lib/data/orgs'
import { getShowBySlug } from '@/lib/data/shows'
import { getDepartmentBySlug } from '@/lib/data/departments'
import { getMaterialsByDepartment } from '@/lib/data/materials'
import { getNotesByMaterial } from '@/lib/data/notes'
import type { NoteWithAuthors } from '@/lib/types/domain'
import { DepartmentClient } from './DepartmentClient'

type Props = {
  params: Promise<{ orgSlug: string; showSlug: string; deptSlug: string }>
}

export default async function DepartmentPage({ params }: Props) {
  const { orgSlug, showSlug, deptSlug } = await params

  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  const show = await getShowBySlug(org, showSlug)
  if (!show) notFound()

  const dept = await getDepartmentBySlug(show, deptSlug)
  if (!dept) notFound()

  const materials = await getMaterialsByDepartment(dept)

  const notesByMaterial: Record<string, NoteWithAuthors[]> =
    Object.fromEntries(
      await Promise.all(
        materials.map(async (m) => [m.id, await getNotesByMaterial(m.id)] as const)
      )
    )

  return (
    <div>
      <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
          <Link href={`/${orgSlug}/shows`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {org.name}
          </Link>
          <span>/</span>
          <Link href={`/${orgSlug}/shows`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Shows
          </Link>
          <span>/</span>
          <Link
            href={`/${orgSlug}/shows/${showSlug}`}
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {show.name}
          </Link>
          <span>/</span>
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">{dept.name}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{dept.name}</h1>
      </div>
      <DepartmentClient
        materials={materials}
        notesByMaterial={notesByMaterial}
        orgId={org.id}
        showId={show.id}
        deptId={dept.id}
        allowReopen={show.allowReopen}
      />
    </div>
  )
}
