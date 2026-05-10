# Playwright E2E Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Playwright E2E tests covering auth, meeting list, meeting creation, join flow, notes drawer, and End Meeting visibility.

**Architecture:** A `globalSetup` uses the Supabase admin API (`generateLink`) to create magic-link URLs for viewer and manager test users, navigates a headless browser through the PKCE callback at `/auth/callback`, and captures `storageState` JSON files. Per-test fixtures inject those states into fresh browser contexts. Two flat spec files cover auth flows and meeting flows.

**Tech Stack:** `@playwright/test`, `dotenv`, `@supabase/supabase-js` (admin client in global setup only)

---

### Task 1: Install Playwright and Chromium

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install packages**

```bash
npm install --save-dev @playwright/test dotenv
```

- [ ] **Step 2: Install Chromium browser binary**

```bash
npx playwright install chromium
```

- [ ] **Step 3: Verify installation**

```bash
npx playwright --version
```
Expected: `Version 1.x.x` — no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install playwright and chromium"
```

---

### Task 2: Configuration, env template, and package.json scripts

**Files:**
- Create: `playwright.config.ts`
- Create: `.env.test.example`
- Modify: `package.json` (add scripts)
- Verify: `.gitignore` (`.env*` pattern already covers `.env.test`)

- [ ] **Step 1: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.test' })

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://localhost:3000',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
  globalSetup: './e2e/global-setup.ts',
})
```

- [ ] **Step 2: Write `.env.test.example`**

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SECRET_KEY=eyJ...
LIVEBLOCKS_SECRET_KEY=sk_...
TEST_USER_EMAIL=viewer@example.com
TEST_MANAGER_EMAIL=manager@example.com
TEST_ORG_SLUG=your-org
TEST_SHOW_SLUG=your-show
```

- [ ] **Step 3: Add scripts to `package.json`**

In the `"scripts"` object, add these two entries alongside the existing ones:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

- [ ] **Step 4: Confirm `.env.test` is gitignored**

```bash
grep "env" .gitignore
```
Expected: `.env*` line is present. If absent, add `.env.test` to `.gitignore` manually.

- [ ] **Step 5: Verify config loads**

```bash
npx playwright test --list
```
Expected: `No tests found` (no spec files yet) with no parse errors.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts .env.test.example package.json
git commit -m "chore: add playwright config and env template"
```

---

### Task 3: Global setup — programmatic auth state generation

**Files:**
- Create: `e2e/global-setup.ts`
- Create: `e2e/.auth/.gitkeep`
- Modify: `.gitignore`

The login page uses magic links (`signInWithOtp`), so there is no password to supply. Instead, globalSetup calls the Supabase admin `generateLink` API to produce a one-time action URL, navigates a headless Chromium context to that URL, waits for the PKCE callback at `/auth/callback` to redirect to `/dashboard`, then captures the resulting cookies via `storageState`. These JSON files are reused by every test that needs an authenticated context.

Note on ordering: Playwright starts the `webServer` before running `globalSetup`, so navigating to `localhost:3000` in globalSetup will succeed.

- [ ] **Step 1: Create `e2e/.auth/` directory and exclude auth state files from git**

```bash
mkdir -p e2e/.auth && touch e2e/.auth/.gitkeep
```

Add to `.gitignore`:
```
e2e/.auth/*.json
```

- [ ] **Step 2: Write `e2e/global-setup.ts`**

```ts
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
```

- [ ] **Step 3: Create `.env.test` from example**

Copy `.env.test.example` to `.env.test` and fill in real values from the dev Supabase project:
- `SUPABASE_SECRET_KEY` must be the `service_role` key (not the anon key)
- `TEST_USER_EMAIL` and `TEST_MANAGER_EMAIL` must exist in the dev Supabase project as show members
- `TEST_ORG_SLUG` and `TEST_SHOW_SLUG` must match the dev database

- [ ] **Step 4: Run to verify globalSetup succeeds**

```bash
npx playwright test --list
```
Expected: `No tests found`, `e2e/.auth/viewer.json` and `e2e/.auth/manager.json` created. If `generateLink` returns an auth error, the `SUPABASE_SECRET_KEY` in `.env.test` is wrong.

- [ ] **Step 5: Commit**

```bash
git add e2e/global-setup.ts e2e/.auth/.gitkeep .gitignore
git commit -m "chore: add playwright global setup with magic-link auth state generation"
```

---

### Task 4: Auth fixture — `authedPage` and `managerPage`

**Files:**
- Create: `e2e/fixtures/auth.ts`

This fixture extends Playwright's base `test` object with two additional fixtures. Each opens a fresh browser context pre-loaded with the corresponding `storageState` and closes it after the test. All meeting tests import `test` from this file instead of from `@playwright/test`.

- [ ] **Step 1: Write `e2e/fixtures/auth.ts`**

```ts
import { test as base, type Page } from '@playwright/test'
import * as path from 'path'

type AuthFixtures = {
  authedPage: Page
  managerPage: Page
}

export const test = base.extend<AuthFixtures>({
  authedPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '../.auth/viewer.json'),
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
  managerPage: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: path.join(__dirname, '../.auth/manager.json'),
    })
    const page = await context.newPage()
    await use(page)
    await context.close()
  },
})

export { expect } from '@playwright/test'
```

- [ ] **Step 2: Commit**

```bash
git add e2e/fixtures/auth.ts
git commit -m "chore: add playwright authedPage and managerPage fixtures"
```

---

### Task 5: Login page URL error display and auth spec

**Files:**
- Modify: `app/(auth)/login/page.tsx`
- Create: `e2e/auth.spec.ts`

The auth callback route (`app/auth/callback/route.ts`) redirects to `/login?error=auth_failed` when `exchangeCodeForSession` fails. The login page currently ignores URL params. Update it to display a visible error when `?error` is present — this makes the "invalid auth code" test assertable.

Because `useSearchParams()` requires a Suspense boundary in Next.js App Router, the error-reading logic is extracted into a tiny inner component.

- [ ] **Step 1: Write the failing tests first**

Create `e2e/auth.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run — expect second test to fail**

```bash
npx playwright test e2e/auth.spec.ts --reporter=list
```
Expected:
- `valid login via magic link redirects to dashboard` — PASS
- `invalid auth code shows error on login page` — FAIL (no `role="alert"` visible)

- [ ] **Step 3: Update `app/(auth)/login/page.tsx`**

Replace the entire file:

```tsx
'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

function LoginError() {
  const params = useSearchParams()
  const error = params.get('error')
  if (!error) return null
  return (
    <p role="alert" className="text-red-400 text-sm">
      {error === 'auth_failed' ? 'Authentication failed. Please try again.' : error}
    </p>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const supabase = createSupabaseBrowserClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setErrorMessage(error.message)
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return <p>Check your email for a magic link.</p>
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Suspense>
        <LoginError />
      </Suspense>
      {errorMessage && <p role="alert">{errorMessage}</p>}
      <button type="submit">Send magic link</button>
    </form>
  )
}
```

- [ ] **Step 4: Run tests — verify both pass**

```bash
npx playwright test e2e/auth.spec.ts --reporter=list
```
Expected: Both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add e2e/auth.spec.ts app/\(auth\)/login/page.tsx
git commit -m "test: add playwright auth specs and login page URL error display"
```

---

### Task 6: Meetings spec

**Files:**
- Create: `e2e/meetings.spec.ts`

**Setup context:** A `beforeAll` block creates a test meeting via the admin Supabase client (bypassing RLS) and stores its ID in module-scoped `testMeetingId`. An `afterAll` block deletes notes and the meeting. Tests that navigate to a specific meeting use `testMeetingId`.

**Notes tests:** The `NotesDrawer` toggle button and composer sit behind the `JoinPrompt` overlay (fixed, z-50). All notes tests click "Browse freely" first to dismiss the overlay before interacting with the drawer. After `addMeetingNote` the server action calls `revalidatePath('', 'layout')`, which triggers a server re-render; the new note appears in the `notes` prop and becomes visible without a manual page reload.

**End Meeting:** `EndMeetingButton` returns `null` when `canManage` is false, so the button is completely absent from the DOM for viewers. Use `not.toBeAttached()` (not in DOM) rather than `not.toBeVisible()` (hidden but present).

- [ ] **Step 1: Write `e2e/meetings.spec.ts`**

```ts
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
  const viewerId = users.find((u) => u.email === process.env.TEST_USER_EMAIL)!.id

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
```

- [ ] **Step 2: Run — expect failures**

```bash
npx playwright test e2e/meetings.spec.ts --reporter=list
```
Expected: Most/all tests fail. This is correct — the failures confirm tests are wired up and the assertions are real.

Common failure modes to diagnose:
- `beforeAll` fails with 404/null: `TEST_ORG_SLUG` or `TEST_SHOW_SLUG` not found — verify slugs in dev Supabase
- `schedule form visible to manager` fails: `TEST_MANAGER_EMAIL` user lacks `can_manage_show` in `role_definitions`
- `join as browse dismisses join prompt` times out: Liveblocks not connecting — check `LIVEBLOCKS_SECRET_KEY` in `.env.test`

- [ ] **Step 3: Verify dev Supabase test data**

Confirm in the Supabase dashboard for the dev project:
1. Org with slug `TEST_ORG_SLUG` exists
2. Show with slug `TEST_SHOW_SLUG` under that org exists
3. `TEST_USER_EMAIL` is a show member without `can_manage_show`
4. `TEST_MANAGER_EMAIL` is a show member with `can_manage_show`

- [ ] **Step 4: Iterate until all 11 tests pass**

```bash
npx playwright test e2e/meetings.spec.ts --reporter=list
```
Expected: All 11 tests pass.

- [ ] **Step 5: Run the full suite**

```bash
npx playwright test --reporter=list
```
Expected: All 13 tests pass (2 auth + 11 meetings).

- [ ] **Step 6: Commit**

```bash
git add e2e/meetings.spec.ts
git commit -m "test: add playwright meetings spec covering join, notes, and End Meeting"
```
