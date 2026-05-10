import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMeetingById } from '@/lib/data/meetings'
import { getNotesByMeeting } from '@/lib/data/notes'
import { getShowBySlug } from '@/lib/data/shows'
import { getOrgBySlug } from '@/lib/data/orgs'
import { getMaterialsByShow } from '@/lib/data/materials'
import { MeetingRoom } from '@/components/meetings/MeetingRoom'

type Props = {
  params: Promise<{ orgSlug: string; showSlug: string; meetingId: string }>
}

export default async function MeetingRoomPage({ params }: Props) {
  const { orgSlug, showSlug, meetingId } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const org = await getOrgBySlug(orgSlug)
  if (!org) redirect('/dashboard')
  const show = await getShowBySlug(org, showSlug)
  if (!show) redirect(`/${orgSlug}`)

  const meeting = await getMeetingById(meetingId)
  if (!meeting || meeting.showId !== show.id) redirect(`/${orgSlug}/shows/${showSlug}/meetings`)

  const [notes, materials, memberData] = await Promise.all([
    getNotesByMeeting(meetingId),
    getMaterialsByShow(show.id),
    supabase
      .from('show_members')
      .select('role_definitions ( permissions )')
      .eq('show_id', show.id)
      .eq('user_id', user.id)
      .single()
      .then((r) => r.data),
  ])

  const canManage = (memberData?.role_definitions as { permissions: string[] } | null)?.permissions?.includes('can_manage_show') ?? false

  const departments = show.departments.map((d) => ({ id: d.id, name: d.name }))

  return (
    <MeetingRoom
      showId={show.id}
      meetingId={meetingId}
      meetingTitle={meeting.title}
      showName={show.name}
      materials={materials}
      notes={notes}
      departments={departments}
      canManage={canManage}
      selfUserId={user.id}
    />
  )
}
