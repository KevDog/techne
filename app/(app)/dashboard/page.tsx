import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Org } from '@/lib/types/domain'

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
    settings: (org.settings ?? { claude_enabled: false }) as {
      claude_enabled: boolean
    },
  }))

  return (
    <main>
      <h1>Your Organizations</h1>
      <ul>
        {typedOrgs.map((org) => (
          <li key={org.id}>{org.name}</li>
        ))}
      </ul>
    </main>
  )
}
