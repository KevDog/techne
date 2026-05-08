# Project Scaffold + Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize a Next.js 14 App Router project with TypeScript, Supabase auth, and a working org/user model with Row Level Security.

**Architecture:** Next.js App Router with Server Components for data fetching and Server Actions for mutations. Supabase handles auth (magic link + email/password), Postgres for data, and RLS for org isolation. No client-side auth logic — all session handling via Supabase SSR helpers.

**Tech Stack:** Next.js 14 (App Router), TypeScript (strict), Supabase (auth + Postgres), Tailwind CSS, Vitest + Testing Library for tests.

---

## File Structure

```text
app/
  layout.tsx                        — root layout, Supabase session provider
  page.tsx                          — redirect to /dashboard or /login
  (auth)/
    login/page.tsx                  — login form
    callback/route.ts               — Supabase auth callback handler
  (app)/
    layout.tsx                      — authenticated layout, requires session
    dashboard/page.tsx              — org list for current user
    orgs/
      [orgId]/page.tsx              — org detail (placeholder for Plan 2)

lib/
  supabase/
    client.ts                       — browser Supabase client (singleton)
    server.ts                       — server Supabase client (cookies)
    middleware.ts                   — session refresh middleware helper
  types/
    db.ts                           — generated Supabase types (via CLI)
    domain.ts                       — app-level domain types (Org, User, etc.)

middleware.ts                       — Next.js middleware: protect (app) routes

supabase/
  migrations/
    001_init.sql                    — users table extension + orgs table + RLS
  seed.sql                          — dev seed: 2 orgs, 3 users

__tests__/
  lib/supabase/server.test.ts       — server client returns valid session
  middleware.test.ts                — unauthenticated requests redirect to /login
  app/(auth)/login/page.test.tsx    — login form renders, submits
  app/(app)/dashboard/page.test.tsx — dashboard renders org list
```

---

## Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `.env.local.example`

- [ ] **Step 1: Scaffold the project**

```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
```

Expected: project files created, `npm run dev` starts on port 3000.

- [ ] **Step 2: Enable strict TypeScript**

In `tsconfig.json`, confirm or add:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

- [ ] **Step 3: Install Supabase and test dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 4: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
```

Create `vitest.setup.ts`:

```typescript
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Add test script to package.json**

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 6: Create .env.local.example**

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
SUPABASE_SECRET_KEY=your-service-role-key
```

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Next.js 14 project with TypeScript and Supabase deps"
```

---

## Task 2: Supabase Project Setup

**Files:**
- Create: `supabase/migrations/001_init.sql`, `supabase/seed.sql`

**Prerequisites:** Install Supabase CLI (`brew install supabase/tap/supabase`). Create a Supabase project at supabase.com. Copy URL and keys into `.env.local`.

- [ ] **Step 1: Initialize Supabase locally**

```bash
supabase init
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

Expected: `supabase/` directory created.

- [ ] **Step 2: Write the initial migration**

Create `supabase/migrations/001_init.sql`:

```sql
-- Extend auth.users with a display name
alter table auth.users add column if not exists display_name text;

-- Organizations table
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

-- Org membership
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(org_id, user_id)
);

-- Enable RLS
alter table public.orgs enable row level security;
alter table public.org_members enable row level security;

-- RLS: users can only see orgs they belong to
create policy "members can view their orgs"
  on public.orgs for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = orgs.id
        and org_members.user_id = auth.uid()
    )
  );

-- RLS: users can see their own memberships
create policy "users can view own memberships"
  on public.org_members for select
  using (user_id = auth.uid());
```

- [ ] **Step 3: Write seed data**

Create `supabase/seed.sql`:

```sql
-- Dev seed: 2 orgs
insert into public.orgs (id, name, slug) values
  ('00000000-0000-0000-0000-000000000001', 'State University Theater', 'state-u-theater'),
  ('00000000-0000-0000-0000-000000000002', 'Riverside Regional Theater', 'riverside-regional');
```

- [ ] **Step 4: Apply migration**

```bash
supabase db push
```

Expected: migration applied, tables visible in Supabase dashboard.

- [ ] **Step 5: Generate TypeScript types**

```bash
supabase gen types typescript --linked > lib/types/db.ts
```

Expected: `lib/types/db.ts` contains typed `Database` interface.

- [ ] **Step 6: Commit**

```bash
git add supabase/ lib/types/db.ts
git commit -m "feat: add initial Supabase migration for orgs and RLS policies"
```

---

## Task 3: Supabase Client Setup

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`, `middleware.ts`

- [ ] **Step 1: Write failing test for server client**

Create `__tests__/lib/supabase/server.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({ auth: { getUser: vi.fn() } })),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}))

describe('createSupabaseServerClient', () => {
  it('returns a client with auth methods', async () => {
    const { createSupabaseServerClient } = await import('@/lib/supabase/server')
    const client = await createSupabaseServerClient()
    expect(client.auth).toBeDefined()
    expect(client.auth.getUser).toBeDefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- __tests__/lib/supabase/server.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/supabase/server'`

- [ ] **Step 3: Implement browser client**

Create `lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/types/db'

export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

- [ ] **Step 4: Implement server client**

Create `lib/supabase/server.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/db'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- __tests__/lib/supabase/server.test.ts
```

Expected: PASS

- [ ] **Step 6: Write failing middleware test**

Create `__tests__/middleware.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
  })),
}))

describe('middleware', () => {
  it('redirects unauthenticated requests to /login', async () => {
    const { middleware } = await import('@/middleware')
    const request = new NextRequest('http://localhost:3000/dashboard')
    const response = await middleware(request)
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('/login')
  })

  it('allows unauthenticated requests to /login', async () => {
    const { middleware } = await import('@/middleware')
    const request = new NextRequest('http://localhost:3000/login')
    const response = await middleware(request)
    expect(response.status).not.toBe(307)
  })
})
```

- [ ] **Step 7: Run test to verify it fails**

```bash
npm test -- __tests__/middleware.test.ts
```

Expected: FAIL — `Cannot find module '@/middleware'`

- [ ] **Step 8: Implement middleware**

Create `middleware.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
    request.nextUrl.pathname.startsWith('/auth')

  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 9: Run tests to verify they pass**

```bash
npm test -- __tests__/middleware.test.ts
```

Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add lib/supabase/ middleware.ts __tests__/
git commit -m "feat: add Supabase client helpers and auth middleware"
```

---

## Task 4: Auth UI (Login Page + Callback)

**Files:**
- Create: `app/(auth)/login/page.tsx`, `app/(auth)/callback/route.ts`
- Create: `__tests__/app/(auth)/login/page.test.tsx`

- [ ] **Step 1: Write failing test for login page**

Create `__tests__/app/(auth)/login/page.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: vi.fn(() => ({
    auth: {
      signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    },
  })),
}))

// Must be a client component — import after mock
describe('LoginPage', () => {
  it('renders email input and submit button', async () => {
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    render(<LoginPage />)
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send magic link/i })).toBeInTheDocument()
  })

  it('submits email on form submit', async () => {
    const { createSupabaseBrowserClient } = await import('@/lib/supabase/client')
    const mockClient = createSupabaseBrowserClient()
    const { default: LoginPage } = await import('@/app/(auth)/login/page')
    render(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'test@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: /send magic link/i }))
    expect(mockClient.auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'test@example.com',
      options: { emailRedirectTo: expect.stringContaining('/auth/callback') },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- "__tests__/app/(auth)/login/page.test.tsx"
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement login page**

Create `app/(auth)/login/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const supabase = createSupabaseBrowserClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
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
      <button type="submit">Send magic link</button>
    </form>
  )
}
```

- [ ] **Step 4: Implement auth callback route**

Create `app/(auth)/callback/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(`${origin}/dashboard`)
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- "__tests__/app/(auth)/login/page.test.tsx"
```

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/(auth)/ __tests__/app/
git commit -m "feat: add magic link login page and auth callback route"
```

---

## Task 5: Domain Types

**Files:**
- Create: `lib/types/domain.ts`

- [ ] **Step 1: Write domain types**

Create `lib/types/domain.ts`:

```typescript
export type Org = {
  id: string
  name: string
  slug: string
  createdAt: string
}

export type OrgMember = {
  id: string
  orgId: string
  userId: string
  createdAt: string
}

export type CurrentUser = {
  id: string
  email: string
  displayName: string | null
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types/domain.ts
git commit -m "feat: add domain types for Org, OrgMember, CurrentUser"
```

---

## Task 6: Dashboard Page (Org List)

**Files:**
- Create: `app/(app)/layout.tsx`, `app/(app)/dashboard/page.tsx`
- Create: `__tests__/app/(app)/dashboard/page.test.tsx`

- [ ] **Step 1: Write failing test for dashboard**

Create `__tests__/app/(app)/dashboard/page.test.tsx`:

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Org } from '@/lib/types/domain'

const mockOrgs: Org[] = [
  { id: '1', name: 'State University Theater', slug: 'state-u-theater', createdAt: '2026-01-01' },
  { id: '2', name: 'Riverside Regional', slug: 'riverside-regional', createdAt: '2026-01-01' },
]

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
    from: vi.fn(() => ({
      select: vi.fn().mockResolvedValue({ data: mockOrgs, error: null }),
    })),
  })),
}))

describe('DashboardPage', () => {
  it('renders a list of org names', async () => {
    const { default: DashboardPage } = await import('@/app/(app)/dashboard/page')
    const jsx = await DashboardPage()
    render(jsx)
    expect(screen.getByText('State University Theater')).toBeInTheDocument()
    expect(screen.getByText('Riverside Regional')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- "__tests__/app/(app)/dashboard/page.test.tsx"
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement authenticated layout**

Create `app/(app)/layout.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return <>{children}</>
}
```

- [ ] **Step 4: Implement dashboard page**

Create `app/(app)/dashboard/page.tsx`:

```typescript
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Org } from '@/lib/types/domain'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  // RLS policy filters to orgs the user belongs to — no extra filter needed
  const { data: orgs } = await supabase
    .from('orgs')
    .select('*')

  return (
    <main>
      <h1>Your Organizations</h1>
      <ul>
        {(orgs as Org[] ?? []).map((org) => (
          <li key={org.id}>{org.name}</li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- "__tests__/app/(app)/dashboard/page.test.tsx"
```

Expected: PASS

- [ ] **Step 6: Run all tests**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 7: Commit**

```bash
git add app/(app)/ __tests__/app/(app)/
git commit -m "feat: add authenticated layout and dashboard org list"
```

---

## Task 7: Smoke Test (Manual)

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify redirect**

Visit `http://localhost:3000` — should redirect to `/login`.

- [ ] **Step 3: Verify login flow**

Enter a real email → click "Send magic link" → check email → click link → should land on `/dashboard`.

- [ ] **Step 4: Verify org list**

Dashboard should show orgs associated with the logged-in user (empty for new users — that's correct).

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete Plan 1 — scaffold, auth, and org dashboard"
```
