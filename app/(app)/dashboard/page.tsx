import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Org, OrgSettings } from '@/lib/types/domain'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()

  // RLS policy filters to orgs the user belongs to — no extra filter needed
  const { data: orgs } = await supabase
    .from('orgs')
    .select('*')

  const typedOrgs: Org[] = (orgs ?? []).map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    createdAt: org.created_at,
    settings: (org.settings ?? { claudeEnabled: false }) as OrgSettings,
  }))

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-4">Your Organizations</h1>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {typedOrgs.map((org) => (
          <li key={org.id}>
            <Link
              href={`/${org.slug}/shows`}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              {org.name}
              <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
