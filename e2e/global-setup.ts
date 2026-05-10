import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as path from 'path'
import * as fs from 'fs'

const BASE_URL = 'http://localhost:3000'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

async function saveAuthState(email: string, statePath: string): Promise<void> {
  const { data, error } = await adminSupabase.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: { redirectTo: `${BASE_URL}/auth/callback` },
  })
  if (error || !data.properties?.action_link) {
    throw new Error(`generateLink failed for ${email}: ${error?.message ?? 'no action_link'}`)
  }

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(data.properties.action_link)
  await page.waitForURL('**/dashboard', { timeout: 20_000 })
  await context.storageState({ path: statePath })
  await browser.close()
}

export default async function globalSetup(): Promise<void> {
  const authDir = path.join(__dirname, '.auth')
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true })

  await saveAuthState(
    process.env.TEST_USER_EMAIL!,
    path.join(authDir, 'viewer.json'),
  )
  await saveAuthState(
    process.env.TEST_MANAGER_EMAIL!,
    path.join(authDir, 'manager.json'),
  )
}
