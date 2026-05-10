import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMeetingsByShow } from '@/lib/data/meetings'
import { getShowBySlug } from '@/lib/data/shows'
import { getOrgBySlug } from '@/lib/data/orgs'
import { createMeeting } from '@/lib/actions/meetings'

type Props = {
  params: Promise<{ orgSlug: string; showSlug: string }>
}

export default async function MeetingsPage({ params }: Props) {
  const { orgSlug, showSlug } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const org = await getOrgBySlug(orgSlug)
  if (!org) redirect('/dashboard')
  const show = await getShowBySlug(org, showSlug)
  if (!show) redirect(`/${orgSlug}`)

  const [meetings, memberData] = await Promise.all([
    getMeetingsByShow(show.id),
    supabase
      .from('show_members')
      .select('role_definitions ( permissions )')
      .eq('show_id', show.id)
      .eq('user_id', user.id)
      .single()
      .then((r) => r.data),
  ])

  const canManage = (memberData?.role_definitions as { permissions: string[] } | null)?.permissions?.includes('can_manage_show') ?? false

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-xl font-semibold">Meetings — {show.name}</h1>
      </div>

      {canManage && (
        <form
          action={async (fd: FormData) => {
            'use server'
            const title = fd.get('title') as string
            const scheduledAt = fd.get('scheduled_at') as string
            await createMeeting(show.id, title, new Date(scheduledAt).toISOString())
          }}
          className="mb-8 bg-neutral-900 border border-neutral-700 rounded-lg p-4 space-y-3"
        >
          <h2 className="text-white text-sm font-medium">Schedule a meeting</h2>
          <input
            name="title"
            required
            placeholder="Meeting title"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder-neutral-500"
          />
          <input
            name="scheduled_at"
            type="datetime-local"
            required
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded"
          >
            Schedule
          </button>
        </form>
      )}

      <div className="space-y-2">
        {meetings.length === 0 && (
          <p className="text-neutral-500 text-sm">No meetings scheduled yet.</p>
        )}
        {meetings.map((m) => (
          <a
            key={m.id}
            href={`/${orgSlug}/shows/${showSlug}/meetings/${m.id}`}
            className="block bg-neutral-900 border border-neutral-700 hover:border-neutral-500 rounded-lg p-4 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium">{m.title}</span>
              {m.endedAt ? (
                <span className="text-neutral-500 text-xs">Ended</span>
              ) : m.startedAt ? (
                <span className="text-green-400 text-xs">● Live</span>
              ) : (
                <span className="text-neutral-400 text-xs">
                  {new Date(m.scheduledAt).toLocaleString()}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
