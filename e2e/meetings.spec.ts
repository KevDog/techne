import { expect } from '@playwright/test'
import { test } from './fixtures/auth'
import { createClient } from '@supabase/supabase-js'

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
)

const MEETINGS_URL = `/${process.env.TEST_ORG_SLUG}/shows/${process.env.TEST_SHOW_SLUG}/meetings`

let testMeetingId: string

test.beforeAll(async () => {
  const { data: org } = await adminSupabase
    .from('orgs')
    .select('id')
    .eq('slug', process.env.TEST_ORG_SLUG!)
    .single()

  const { data: show } = await adminSupabase
    .from('shows')
    .select('id')
    .eq('org_id', org!.id)
    .eq('slug', process.env.TEST_SHOW_SLUG!)
    .single()

  const { data: { users } } = await adminSupabase.auth.admin.listUsers({ perPage: 200 })
  const viewerId = (users as { id: string; email?: string }[]).find((u) => u.email === process.env.TEST_USER_EMAIL)!.id

  const { data: meeting } = await adminSupabase
    .from('meetings')
    .insert({
      show_id: show!.id,
      title: 'E2E Navigation Meeting',
      scheduled_at: new Date('2030-06-01T14:00:00Z').toISOString(),
      created_by: viewerId,
    })
    .select('id')
    .single()

  testMeetingId = meeting!.id
})

test.afterAll(async () => {
  if (!testMeetingId) return
  await adminSupabase.from('notes').delete().eq('meeting_id', testMeetingId)
  await adminSupabase.from('meetings').delete().eq('id', testMeetingId)
})

// ── Meeting list ──────────────────────────────────────────────────────────────

test('meeting list loads', async ({ authedPage }) => {
  await authedPage.goto(MEETINGS_URL)
  await expect(authedPage.locator('h1')).toContainText('Meetings')
  await expect(authedPage.locator(`a[href*="/meetings/${testMeetingId}"]`)).toBeVisible()
})

test('schedule form hidden from viewer', async ({ authedPage }) => {
  await authedPage.goto(MEETINGS_URL)
  await expect(authedPage.locator('h2:has-text("Schedule a meeting")')).not.toBeVisible()
})

test('schedule form visible to manager', async ({ managerPage }) => {
  await managerPage.goto(MEETINGS_URL)
  await expect(managerPage.locator('h2:has-text("Schedule a meeting")')).toBeVisible()
})

test('create meeting', async ({ managerPage }) => {
  await managerPage.goto(MEETINGS_URL)
  const title = `E2E Created ${Date.now()}`
  await managerPage.fill('input[name="title"]', title)
  await managerPage.locator('input[name="scheduled_at"]').fill('2030-12-01T10:00')
  await managerPage.click('button[type="submit"]:has-text("Schedule")')
  await expect(managerPage.locator(`text=${title}`)).toBeVisible({ timeout: 8_000 })
})

// ── Meeting room ──────────────────────────────────────────────────────────────

test('navigate to meeting', async ({ authedPage }) => {
  await authedPage.goto(MEETINGS_URL)
  await authedPage.locator(`a[href*="/meetings/${testMeetingId}"]`).click()
  await authedPage.waitForURL(`**/${testMeetingId}`, { timeout: 10_000 })
})

test('join prompt shown', async ({ authedPage }) => {
  await authedPage.goto(`${MEETINGS_URL}/${testMeetingId}`)
  await expect(authedPage.getByRole('button', { name: /join as viewer/i })).toBeVisible({ timeout: 10_000 })
  await expect(authedPage.getByRole('button', { name: /browse freely/i })).toBeVisible()
})

test('join as browse dismisses join prompt', async ({ authedPage }) => {
  await authedPage.goto(`${MEETINGS_URL}/${testMeetingId}`)
  await authedPage.getByRole('button', { name: /browse freely/i }).click()
  await expect(authedPage.getByRole('button', { name: /join as viewer/i })).not.toBeVisible({ timeout: 8_000 })
  await expect(authedPage.locator('text=Click a thumbnail')).toBeVisible()
})

test('notes drawer collapsed initially', async ({ authedPage }) => {
  await authedPage.goto(`${MEETINGS_URL}/${testMeetingId}`)
  await authedPage.getByRole('button', { name: /browse freely/i }).click()
  await expect(authedPage.locator('input[placeholder="Add a note..."]')).not.toBeVisible()
})

test('notes drawer expands on click', async ({ authedPage }) => {
  await authedPage.goto(`${MEETINGS_URL}/${testMeetingId}`)
  await authedPage.getByRole('button', { name: /browse freely/i }).click()
  await authedPage.getByRole('button', { name: /notes/i }).click()
  await expect(authedPage.locator('input[placeholder="Add a note..."]')).toBeVisible()
})

test('add a note', async ({ authedPage }) => {
  const noteText = `E2E note ${Date.now()}`
  await authedPage.goto(`${MEETINGS_URL}/${testMeetingId}`)
  await authedPage.getByRole('button', { name: /browse freely/i }).click()
  await authedPage.getByRole('button', { name: /notes/i }).click()
  await authedPage.fill('input[placeholder="Add a note..."]', noteText)
  await authedPage.getByRole('button', { name: 'Add' }).click()
  await expect(authedPage.locator(`text=${noteText}`)).toBeVisible({ timeout: 8_000 })
})

test('End Meeting button hidden from viewer', async ({ authedPage }) => {
  await authedPage.goto(`${MEETINGS_URL}/${testMeetingId}`)
  await authedPage.getByRole('button', { name: /browse freely/i }).click()
  await expect(authedPage.getByRole('button', { name: /end meeting/i })).not.toBeAttached()
})

test('End Meeting button visible to manager', async ({ managerPage }) => {
  await managerPage.goto(`${MEETINGS_URL}/${testMeetingId}`)
  await managerPage.getByRole('button', { name: /browse freely/i }).click()
  await expect(managerPage.getByRole('button', { name: /end meeting/i })).toBeVisible({ timeout: 10_000 })
})
