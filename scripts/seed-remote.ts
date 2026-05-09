// One-time script to seed remote Supabase with dev orgs and add a user to one
// Usage: npx tsx scripts/seed-remote.ts <user-email>
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const env = fs.readFileSync(path.join(process.cwd(), '.env/.local'), 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim()
const key = env.match(/SUPABASE_SECRET_KEY=(.+)/)?.[1]?.trim()

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env/.local')
  process.exit(1)
}

const supabase = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  // Insert seed orgs (ignore conflict if already exists)
  const { error: orgError } = await supabase.from('orgs').upsert([
    { id: '00000000-0000-0000-0000-000000000001', name: 'State University Theater', slug: 'state-u-theater' },
    { id: '00000000-0000-0000-0000-000000000002', name: 'Riverside Regional Theater', slug: 'riverside-regional' },
  ], { onConflict: 'id' })

  if (orgError) {
    console.error('Error inserting orgs:', orgError.message)
    process.exit(1)
  }
  console.log('Orgs seeded.')

  // If email provided, add that user to org 1
  const email = process.argv[2]
  if (email) {
    const { data: users, error: userError } = await supabase.auth.admin.listUsers()
    if (userError) { console.error('Error listing users:', userError.message); process.exit(1) }

    const user = users.users.find(u => u.email === email)
    if (!user) { console.error(`No user found with email: ${email}`); process.exit(1) }

    const { error: memberError } = await supabase.from('org_members').upsert(
      { org_id: '00000000-0000-0000-0000-000000000001', user_id: user.id },
      { onConflict: 'org_id,user_id' }
    )
    if (memberError) { console.error('Error adding member:', memberError.message); process.exit(1) }
    console.log(`User ${email} added to State University Theater.`)
  }
}

main()
