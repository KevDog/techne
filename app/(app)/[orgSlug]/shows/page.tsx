import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrgBySlug } from '@/lib/data/orgs'
import { getShowsByOrg, type ShowWithRelations } from '@/lib/data/shows'

type Props = {
  params: Promise<{ orgSlug: string }>
}

function groupBySeasonName(shows: ShowWithRelations[]) {
  const groups = new Map<string, ShowWithRelations[]>()
  for (const show of shows) {
    const key = show.season?.name ?? 'Unseasoned'
    const group = groups.get(key) ?? []
    group.push(show)
    groups.set(key, group)
  }
  return groups
}

function featuredMemberName(show: ShowWithRelations): string | null {
  const featured = show.show_members.find((m) => m.featured)
  return featured?.profiles?.display_name ?? null
}

export default async function ShowsPage({ params }: Props) {
  const { orgSlug } = await params
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  const shows = await getShowsByOrg(org)
  const grouped = groupBySeasonName(shows)

  return (
    <div className="flex min-h-screen">
      {/* Sidebar: season filter */}
      <aside className="w-44 shrink-0 border-r border-zinc-200 dark:border-zinc-800 p-4">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-3">Season</p>
        <nav className="flex flex-col gap-1">
          {Array.from(grouped.keys()).map((name) => (
            <span
              key={name}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {name}
            </span>
          ))}
        </nav>
      </aside>

      {/* Main: show list */}
      <main className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">{org.name}</h1>
          <p className="text-sm text-zinc-500">Shows</p>
        </div>

        {Array.from(grouped.entries()).map(([seasonName, seasonShows]) => (
          <section key={seasonName} className="mb-8">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-3">
              {seasonName}
            </p>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              {seasonShows.map((show) => {
                const featured = featuredMemberName(show)
                const subtitle = [
                  featured,
                  `${show.departments.length} departments`,
                  `${show.show_members.length} members`,
                ]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <li key={show.id}>
                    <Link
                      href={`/${orgSlug}/shows/${show.slug}`}
                      className="flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{show.name}</p>
                        {subtitle && (
                          <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>
                        )}
                      </div>
                      <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                      </svg>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </main>
    </div>
  )
}
