import { Liveblocks } from '@liveblocks/node'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const liveblocks = new Liveblocks({ secret: process.env.LIVEBLOCKS_SECRET_KEY! })

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const name = profile?.display_name ?? user.email ?? 'Unknown'
  const initials = name.split(' ').map((w: string) => w[0] ?? '').slice(0, 2).join('').toUpperCase()

  const session = liveblocks.prepareSession(user.id, {
    userInfo: { name, initials },
  })

  const { room } = await req.json()

  if (!room || typeof room !== 'string') {
    return new Response('Bad Request', { status: 400 })
  }

  // Validate room name format and extract showId
  const match = room.match(/^show-([0-9a-f-]{36})$/)
  if (!match) {
    return new Response('Invalid room', { status: 400 })
  }
  const showId = match[1]!

  // Verify user is a show member
  const { data: membership } = await supabase
    .from('show_members')
    .select('id')
    .eq('show_id', showId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) {
    return new Response('Forbidden', { status: 403 })
  }

  session.allow(room, session.FULL_ACCESS)

  const { status, body } = await session.authorize()
  return new Response(body, { status })
}
