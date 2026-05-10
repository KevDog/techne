import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

test('valid login via magic link redirects to dashboard', async ({ page }) => {
  const { data, error } = await adminSupabase.auth.admin.generateLink({
    type: 'magiclink',
    email: process.env.TEST_USER_EMAIL!,
    options: { redirectTo: 'http://localhost:3000/auth/callback' },
  })
  expect(error).toBeNull()
  await page.goto(data!.properties.action_link)
  await page.waitForURL('**/dashboard', { timeout: 20_000 })
  expect(page.url()).toContain('/dashboard')
})

test('invalid auth code shows error on login page', async ({ page }) => {
  await page.goto('http://localhost:3000/auth/callback?code=invalid_code_xyz')
  await page.waitForURL('**/login**', { timeout: 10_000 })
  await expect(page.getByRole('alert')).toBeVisible()
})
