import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrgBySlug } from '@/lib/data/orgs'
import { getShowBySlug } from '@/lib/data/shows'

type Props = {
  params: Promise<{ orgSlug: string; showSlug: string }>
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default async function ShowDetailPage({ params }: Props) {
  const { orgSlug, showSlug } = await params
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  const show = await getShowBySlug(org, showSlug)
  if (!show) notFound()

  const featuredMember = show.show_members.find((m) => m.featured)

  return (
    <div>
      {/* Breadcrumb + header */}
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
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">{show.name}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{show.name}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {[show.season?.name, featuredMember?.profiles?.display_name]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {/* Two-column body */}
      <div className="flex">
        {/* Members (left) */}
        <aside className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 p-6">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-4">Members</p>
          <ul className="flex flex-col gap-3">
            {show.show_members.map((member) => (
              <li key={member.id} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {initials(member.profiles?.display_name)}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {member.profiles?.display_name ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {member.role_definitions?.name ?? '—'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Departments (right) */}
        <main className="flex-1 p-6">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-4">Departments</p>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {show.departments.map((dept) => (
              <li key={dept.id}>
                <Link
                  href={`/${orgSlug}/shows/${showSlug}/departments/${dept.slug}`}
                  className="flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900"
                >
                  {dept.name}
                </Link>
              </li>
            ))}
          </ul>
        </main>
      </div>
    </div>
  )
}
