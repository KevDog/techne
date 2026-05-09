# Plan 2: Data Hierarchy + Flexible Roles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the full org → season → show → department data hierarchy with flexible roles to the database, extend TypeScript types, add a data access layer, and build read-only browse UI at `/[orgSlug]/shows` and `/[orgSlug]/shows/[showSlug]`.

**Architecture:** New Supabase migration adds `profiles`, `seasons`, `shows`, `departments`, `role_definitions`, and `show_members` tables with RLS. A `lib/data/` layer wraps Supabase queries with `React.cache()` for request-scoped deduplication. All pages are Server Components. The `[orgSlug]/layout.tsx` is the trust boundary — it resolves and validates the org once; child pages trust it.

**Tech Stack:** Next.js 16 (App Router), TypeScript strict, Supabase (Postgres + RLS), Tailwind CSS v4, Tailwind Plus component patterns, Vitest + Testing Library.

---

## File Structure

```text
supabase/
  migrations/
    20260509000000_plan_2_hierarchy.sql   — profiles + 5 new tables + orgs.settings + RLS + seed
  seed.sql                                — extended with seasons, shows, departments, role_definitions

lib/
  types/
    domain.ts                             — add OrgSettings, Season, Show, Department, RoleDefinition, ShowMember; update Org
    db.ts                                 — add Row/Insert/Update types for all 6 new tables
  data/
    orgs.ts                               — getOrgBySlug (React.cache)
    shows.ts                              — getShowsByOrg, getShowBySlug (React.cache)

app/
  (app)/
    dashboard/page.tsx                    — update org links to /[orgSlug]/shows
    [orgSlug]/
      layout.tsx                          — resolve org, 404 if not member
      shows/
        page.tsx                          — shows list grouped by season
        [showSlug]/
          page.tsx                        — show detail: members left, departments right

__tests__/
  app/(app)/dashboard/page.test.tsx       — update to assert link href
  app/(app)/[orgSlug]/layout.test.tsx     — 404 when org missing or user not member
  app/(app)/[orgSlug]/shows/page.test.tsx — renders shows grouped by season
  app/(app)/[orgSlug]/shows/[showSlug]/page.test.tsx — renders members and departments
```

---

## Task 1: Database migration

**Files:**

- Create: `supabase/migrations/20260509000000_plan_2_hierarchy.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260509000000_plan_2_hierarchy.sql`:

```sql
-- Extend orgs with settings
alter table public.orgs
  add column settings jsonb not null default '{"claude_enabled": false}';

-- Profiles: public mirror of auth.users for display names
-- Standard Supabase pattern — accessible via PostgREST with RLS
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users can view all profiles"
  on public.profiles for select
  using (true);

create policy "users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

-- Auto-create profile on sign-up
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Seasons
create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  unique(org_id, slug)
);

alter table public.seasons enable row level security;

create policy "org members can view seasons"
  on public.seasons for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = seasons.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Shows
create table public.shows (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  season_id uuid references public.seasons(id) on delete set null,
  name text not null,
  slug text not null,
  approval_mode text not null default 'single' check (approval_mode in ('single', 'multi')),
  allow_reopen boolean not null default false,
  created_at timestamptz not null default now(),
  unique(org_id, slug)
);

alter table public.shows enable row level security;

create policy "org members can view shows"
  on public.shows for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = shows.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Departments
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.departments enable row level security;

create policy "org members can view departments"
  on public.departments for select
  using (
    exists (
      select 1 from public.shows
      join public.org_members on org_members.org_id = shows.org_id
      where shows.id = departments.show_id
        and org_members.user_id = auth.uid()
    )
  );

-- Role definitions
create table public.role_definitions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  show_id uuid references public.shows(id) on delete cascade,
  name text not null,
  permissions text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.role_definitions enable row level security;

create policy "org members can view role definitions"
  on public.role_definitions for select
  using (
    exists (
      select 1 from public.org_members
      where org_members.org_id = role_definitions.org_id
        and org_members.user_id = auth.uid()
    )
  );

-- Show members
create table public.show_members (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role_definition_id uuid not null references public.role_definitions(id),
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  unique(show_id, user_id)
);

-- At most one featured member per show
create unique index show_members_one_featured_per_show
  on public.show_members (show_id) where (featured = true);

alter table public.show_members enable row level security;

create policy "org members can view show members"
  on public.show_members for select
  using (
    exists (
      select 1 from public.shows
      join public.org_members on org_members.org_id = shows.org_id
      where shows.id = show_members.show_id
        and org_members.user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Extend seed data**

Replace contents of `supabase/seed.sql`:

```sql
-- Orgs
insert into public.orgs (id, name, slug) values
  ('00000000-0000-0000-0000-000000000001', 'State University Theater', 'state-u-theater'),
  ('00000000-0000-0000-0000-000000000002', 'Riverside Regional Theater', 'riverside-regional');

-- Seasons
insert into public.seasons (id, org_id, name, slug) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '2025–26 Season', '2025-26'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '2024–25 Season', '2024-25'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '2025–26 Season', '2025-26');

-- Shows
insert into public.shows (id, org_id, season_id, name, slug, approval_mode, allow_reopen) values
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Hamlet', 'hamlet', 'multi', true),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'The Tempest', 'the-tempest', 'single', false),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'King Lear', 'king-lear', 'multi', false),
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'A Streetcar Named Desire', 'streetcar', 'single', true);

-- Departments
insert into public.departments (id, show_id, name) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Scenic Design'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Costume Design'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Lighting Design'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Scenic Design'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'Costume Design'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 'Scenic Design'),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000004', 'Costume Design');

-- Role definitions (org-level defaults)
insert into public.role_definitions (id, org_id, show_id, name, permissions) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', null, 'Director', '{can_approve,can_manage_members,can_manage_show}'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', null, 'Designer', '{can_upload}'),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', null, 'Director', '{can_approve,can_manage_members,can_manage_show}'),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', null, 'Designer', '{can_upload}');
```

- [ ] **Step 3: Apply migration to local Supabase**

```bash
npx supabase db reset
```

Expected: migration runs without errors, seed data is inserted.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260509000000_plan_2_hierarchy.sql supabase/seed.sql
git commit -m "feat: add hierarchy migration and seed data"
```

---

## Task 2: TypeScript types

**Files:**

- Modify: `lib/types/domain.ts`
- Modify: `lib/types/db.ts`

- [ ] **Step 1: Update `lib/types/domain.ts`**

Replace the file contents:

```ts
export type OrgSettings = {
  claude_enabled: boolean
}

export type Org = {
  id: string
  name: string
  slug: string
  settings: OrgSettings
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

export type Season = {
  id: string
  orgId: string
  name: string
  slug: string
  createdAt: string
}

export type Show = {
  id: string
  orgId: string
  seasonId: string | null
  name: string
  slug: string
  approvalMode: 'single' | 'multi'
  allowReopen: boolean
  createdAt: string
}

export type Department = {
  id: string
  showId: string
  name: string
  createdAt: string
}

export type RoleDefinition = {
  id: string
  orgId: string
  showId: string | null
  name: string
  permissions: string[]
  createdAt: string
}

export type ShowMember = {
  id: string
  showId: string
  userId: string
  roleDefinitionId: string
  featured: boolean
  createdAt: string
}

export type Profile = {
  id: string
  displayName: string | null
  updatedAt: string
}
```

- [ ] **Step 2: Extend `lib/types/db.ts`**

Add to the `Tables` object inside `Database['public']`, after the existing `orgs` entry:

```ts
      profiles: {
        Row: {
          id: string
          display_name: string | null
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seasons: {
        Row: {
          id: string
          org_id: string
          name: string
          slug: string
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          name: string
          slug: string
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          name?: string
          slug?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          }
        ]
      }
      shows: {
        Row: {
          id: string
          org_id: string
          season_id: string | null
          name: string
          slug: string
          approval_mode: string
          allow_reopen: boolean
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          season_id?: string | null
          name: string
          slug: string
          approval_mode?: string
          allow_reopen?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          season_id?: string | null
          name?: string
          slug?: string
          approval_mode?: string
          allow_reopen?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shows_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          }
        ]
      }
      departments: {
        Row: {
          id: string
          show_id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          show_id: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          show_id?: string
          name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          }
        ]
      }
      role_definitions: {
        Row: {
          id: string
          org_id: string
          show_id: string | null
          name: string
          permissions: string[]
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          show_id?: string | null
          name: string
          permissions?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          org_id?: string
          show_id?: string | null
          name?: string
          permissions?: string[]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_definitions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          }
        ]
      }
      show_members: {
        Row: {
          id: string
          show_id: string
          user_id: string
          role_definition_id: string
          featured: boolean
          created_at: string
        }
        Insert: {
          id?: string
          show_id: string
          user_id: string
          role_definition_id: string
          featured?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          show_id?: string
          user_id?: string
          role_definition_id?: string
          featured?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "show_members_show_id_fkey"
            columns: ["show_id"]
            isOneToOne: false
            referencedRelation: "shows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "show_members_role_definition_id_fkey"
            columns: ["role_definition_id"]
            isOneToOne: false
            referencedRelation: "role_definitions"
            referencedColumns: ["id"]
          }
        ]
      }
```

Also add `settings: Json` to `orgs.Row`, `orgs.Insert`, and `orgs.Update`:

```ts
// In orgs.Row — add:
settings: Json

// In orgs.Insert — add:
settings?: Json

// In orgs.Update — add:
settings?: Json
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add lib/types/domain.ts lib/types/db.ts
git commit -m "feat: add Plan 2 domain and db types"
```

---

## Task 3: Data access layer

**Files:**

- Create: `lib/data/orgs.ts`
- Create: `lib/data/shows.ts`
- Create: `__tests__/lib/data/orgs.test.ts`
- Create: `__tests__/lib/data/shows.test.ts`

- [ ] **Step 1: Write failing tests for `getOrgBySlug`**

Create `__tests__/lib/data/orgs.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({ from: mockFrom })),
}))

describe('getOrgBySlug', () => {
  beforeEach(() => vi.resetModules())

  it('returns org when found', async () => {
    mockSingle.mockResolvedValue({
      data: {
        id: '1', name: 'Test Org', slug: 'test-org',
        settings: { claude_enabled: false }, created_at: '2026-01-01',
      },
      error: null,
    })
    const { getOrgBySlug } = await import('@/lib/data/orgs')
    const result = await getOrgBySlug('test-org')
    expect(result).not.toBeNull()
    expect(result?.slug).toBe('test-org')
  })

  it('returns null when not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const { getOrgBySlug } = await import('@/lib/data/orgs')
    const result = await getOrgBySlug('missing')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npm test -- __tests__/lib/data/orgs.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/data/orgs'`

- [ ] **Step 3: Write failing tests for `getShowsByOrg` and `getShowBySlug`**

Create `__tests__/lib/data/shows.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockEqSlug = vi.fn(() => ({ single: mockSingle }))
const mockEqOrg = vi.fn(() => ({
  order: vi.fn().mockResolvedValue({ data: [], error: null }),
  eq: mockEqSlug,
}))
const mockSelect = vi.fn(() => ({ eq: mockEqOrg }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn(() => Promise.resolve({ from: mockFrom })),
}))

const org = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'State U Theater',
  slug: 'state-u-theater',
  settings: { claude_enabled: false },
  createdAt: '2026-01-01',
}

describe('getShowsByOrg', () => {
  beforeEach(() => vi.resetModules())

  it('returns empty array when org has no shows', async () => {
    const { getShowsByOrg } = await import('@/lib/data/shows')
    const result = await getShowsByOrg(org)
    expect(result).toEqual([])
  })
})

describe('getShowBySlug', () => {
  beforeEach(() => vi.resetModules())

  it('returns null when show not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
    const { getShowBySlug } = await import('@/lib/data/shows')
    const result = await getShowBySlug(org, 'missing')
    expect(result).toBeNull()
  })
})
```

- [ ] **Step 4: Run to verify tests fail**

```bash
npm test -- __tests__/lib/data/shows.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/data/shows'`

- [ ] **Step 5: Implement `lib/data/orgs.ts`**

Create `lib/data/orgs.ts`:

```ts
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Org } from '@/lib/types/domain'

export const getOrgBySlug = cache(async (slug: string): Promise<Org | null> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('orgs')
    .select('*')
    .eq('slug', slug)
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    settings: data.settings as Org['settings'],
    createdAt: data.created_at,
  }
})
```

- [ ] **Step 6: Implement `lib/data/shows.ts`**

Create `lib/data/shows.ts`:

```ts
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Org } from '@/lib/types/domain'

export type ShowWithRelations = {
  id: string
  name: string
  slug: string
  orgId: string
  seasonId: string | null
  approvalMode: 'single' | 'multi'
  allowReopen: boolean
  createdAt: string
  season: { name: string; slug: string } | null
  departments: { id: string }[]
  show_members: {
    id: string
    featured: boolean
    profiles: { display_name: string | null } | null
    role_definitions: { name: string } | null
  }[]
}

export const getShowsByOrg = cache(async (org: Org): Promise<ShowWithRelations[]> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('shows')
    .select(`
      id, name, slug, org_id, season_id, approval_mode, allow_reopen, created_at,
      season:seasons ( name, slug ),
      departments ( id ),
      show_members ( id, featured, profiles ( display_name ), role_definitions ( name ) )
    `)
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    orgId: row.org_id,
    seasonId: row.season_id,
    approvalMode: row.approval_mode as 'single' | 'multi',
    allowReopen: row.allow_reopen,
    createdAt: row.created_at,
    season: Array.isArray(row.season) ? (row.season[0] ?? null) : (row.season ?? null),
    departments: (row.departments as { id: string }[]) ?? [],
    show_members: (row.show_members as ShowWithRelations['show_members']) ?? [],
  }))
})

export type ShowDetail = ShowWithRelations & {
  departments: { id: string; name: string; created_at: string }[]
}

export const getShowBySlug = cache(async (org: Org, slug: string): Promise<ShowDetail | null> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('shows')
    .select(`
      id, name, slug, org_id, season_id, approval_mode, allow_reopen, created_at,
      season:seasons ( name, slug ),
      departments ( id, name, created_at ),
      show_members ( id, featured, profiles ( display_name ), role_definitions ( name ) )
    `)
    .eq('org_id', org.id)
    .eq('slug', slug)
    .single()
  if (error || !data) return null
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    orgId: data.org_id,
    seasonId: data.season_id,
    approvalMode: data.approval_mode as 'single' | 'multi',
    allowReopen: data.allow_reopen,
    createdAt: data.created_at,
    season: Array.isArray(data.season) ? (data.season[0] ?? null) : (data.season ?? null),
    departments: (data.departments as ShowDetail['departments']) ?? [],
    show_members: (data.show_members as ShowWithRelations['show_members']) ?? [],
  }
})
```

- [ ] **Step 7: Run all data layer tests**

```bash
npm test -- __tests__/lib/data/
```

Expected: all PASS.

- [ ] **Step 8: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/data/ __tests__/lib/data/
git commit -m "feat: add org and show data access layer"
```

---

## Task 4: Org layout boundary

**Files:**

- Create: `app/(app)/[orgSlug]/layout.tsx`
- Create: `__tests__/app/(app)/[orgSlug]/layout.test.tsx`

- [ ] **Step 1: Write failing test**

Create `__tests__/app/(app)/[orgSlug]/layout.test.tsx`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockGetOrgBySlug = vi.fn()
const mockNotFound = vi.fn()

vi.mock('@/lib/data/orgs', () => ({ getOrgBySlug: mockGetOrgBySlug }))
vi.mock('next/navigation', () => ({ notFound: mockNotFound }))

describe('OrgLayout', () => {
  it('renders children when org is found', async () => {
    mockGetOrgBySlug.mockResolvedValue({
      id: '1', name: 'State U Theater', slug: 'state-u-theater',
      settings: { claude_enabled: false }, createdAt: '2026-01-01',
    })
    const { default: OrgLayout } = await import('@/app/(app)/[orgSlug]/layout')
    const jsx = await OrgLayout({
      children: <div>child content</div>,
      params: Promise.resolve({ orgSlug: 'state-u-theater' }),
    })
    render(jsx)
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('calls notFound when org does not exist', async () => {
    mockGetOrgBySlug.mockResolvedValue(null)
    const { default: OrgLayout } = await import('@/app/(app)/[orgSlug]/layout')
    mockNotFound.mockImplementation(() => { throw new Error('NOT_FOUND') })
    await expect(
      OrgLayout({
        children: <div />,
        params: Promise.resolve({ orgSlug: 'missing' }),
      })
    ).rejects.toThrow('NOT_FOUND')
  })
})
```

- [ ] **Step 2: Run to verify test fails**

```bash
npm test -- "__tests__/app/(app)/\[orgSlug\]/layout.test.tsx"
```

Expected: FAIL — `Cannot find module '@/app/(app)/[orgSlug]/layout'`

- [ ] **Step 3: Implement the layout**

Create `app/(app)/[orgSlug]/layout.tsx`:

```tsx
import { notFound } from 'next/navigation'
import { getOrgBySlug } from '@/lib/data/orgs'

type Props = {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}

export default async function OrgLayout({ children, params }: Props) {
  const { orgSlug } = await params
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()
  return <>{children}</>
}
```

- [ ] **Step 4: Run test**

```bash
npm test -- "__tests__/app/(app)/\[orgSlug\]/layout.test.tsx"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/[orgSlug]/layout.tsx" "__tests__/app/(app)/[orgSlug]/layout.test.tsx"
git commit -m "feat: add org layout boundary with 404 guard"
```

---

## Task 5: Shows list page

**Files:**

- Create: `app/(app)/[orgSlug]/shows/page.tsx`
- Create: `__tests__/app/(app)/[orgSlug]/shows/page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `__tests__/app/(app)/[orgSlug]/shows/page.test.tsx`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ShowWithRelations } from '@/lib/data/shows'

const org = {
  id: '00000000-0000-0000-0000-000000000001',
  name: 'State U Theater',
  slug: 'state-u-theater',
  settings: { claude_enabled: false },
  createdAt: '2026-01-01',
}

const mockShows: ShowWithRelations[] = [
  {
    id: '1', name: 'Hamlet', slug: 'hamlet', orgId: org.id,
    seasonId: 'season-1', approvalMode: 'multi', allowReopen: true,
    createdAt: '2026-01-01',
    season: { name: '2025–26 Season', slug: '2025-26' },
    departments: [{ id: 'd1' }, { id: 'd2' }],
    show_members: [
      {
        id: 'm1', featured: true,
        profiles: { display_name: 'Antoni Cimolino' },
        role_definitions: { name: 'Director' },
      },
    ],
  },
  {
    id: '2', name: 'King Lear', slug: 'king-lear', orgId: org.id,
    seasonId: 'season-2', approvalMode: 'multi', allowReopen: false,
    createdAt: '2026-01-02',
    season: { name: '2024–25 Season', slug: '2024-25' },
    departments: [],
    show_members: [],
  },
]

vi.mock('@/lib/data/orgs', () => ({ getOrgBySlug: vi.fn().mockResolvedValue(org) }))
vi.mock('@/lib/data/shows', () => ({ getShowsByOrg: vi.fn().mockResolvedValue(mockShows) }))

describe('ShowsPage', () => {
  it('renders show names', async () => {
    const { default: ShowsPage } = await import('@/app/(app)/[orgSlug]/shows/page')
    const jsx = await ShowsPage({ params: Promise.resolve({ orgSlug: 'state-u-theater' }) })
    render(jsx)
    expect(screen.getByText('Hamlet')).toBeInTheDocument()
    expect(screen.getByText('King Lear')).toBeInTheDocument()
  })

  it('renders season group headings', async () => {
    const { default: ShowsPage } = await import('@/app/(app)/[orgSlug]/shows/page')
    const jsx = await ShowsPage({ params: Promise.resolve({ orgSlug: 'state-u-theater' }) })
    render(jsx)
    expect(screen.getByText('2025–26 Season')).toBeInTheDocument()
    expect(screen.getByText('2024–25 Season')).toBeInTheDocument()
  })

  it('renders featured member name in show subtitle', async () => {
    const { default: ShowsPage } = await import('@/app/(app)/[orgSlug]/shows/page')
    const jsx = await ShowsPage({ params: Promise.resolve({ orgSlug: 'state-u-theater' }) })
    render(jsx)
    expect(screen.getByText(/Antoni Cimolino/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npm test -- "__tests__/app/(app)/\[orgSlug\]/shows/page.test.tsx"
```

Expected: FAIL — `Cannot find module '@/app/(app)/[orgSlug]/shows/page'`

- [ ] **Step 3: Implement the shows list page**

Create `app/(app)/[orgSlug]/shows/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrgBySlug } from '@/lib/data/orgs'
import { getShowsByOrg, type ShowWithRelations } from '@/lib/data/shows'

type Props = {
  params: Promise<{ orgSlug: string }>
}

function groupBySeasonName(shows: ShowWithRelations[]) {
  const groups = new Map<string, ShowWithRelations[]>()
  for (const show of shows) {
    const key = show.season?.name ?? 'Unseasoned'
    const group = groups.get(key) ?? []
    group.push(show)
    groups.set(key, group)
  }
  return groups
}

function featuredMemberName(show: ShowWithRelations): string | null {
  const featured = show.show_members.find((m) => m.featured)
  return featured?.profiles?.display_name ?? null
}

export default async function ShowsPage({ params }: Props) {
  const { orgSlug } = await params
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  const shows = await getShowsByOrg(org)
  const grouped = groupBySeasonName(shows)

  return (
    <div className="flex min-h-screen">
      {/* Sidebar: season filter */}
      <aside className="w-44 shrink-0 border-r border-zinc-200 dark:border-zinc-800 p-4">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-3">Season</p>
        <nav className="flex flex-col gap-1">
          {Array.from(grouped.keys()).map((name) => (
            <span
              key={name}
              className="rounded-md px-3 py-1.5 text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              {name}
            </span>
          ))}
        </nav>
      </aside>

      {/* Main: show list */}
      <main className="flex-1 p-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold">{org.name}</h1>
          <p className="text-sm text-zinc-500">Shows</p>
        </div>

        {Array.from(grouped.entries()).map(([seasonName, seasonShows]) => (
          <section key={seasonName} className="mb-8">
            <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-3">
              {seasonName}
            </p>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              {seasonShows.map((show) => {
                const featured = featuredMemberName(show)
                const subtitle = [
                  featured,
                  `${show.departments.length} departments`,
                  `${show.show_members.length} members`,
                ]
                  .filter(Boolean)
                  .join(' · ')

                return (
                  <li key={show.id}>
                    <Link
                      href={`/${orgSlug}/shows/${show.slug}`}
                      className="flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{show.name}</p>
                        {subtitle && (
                          <p className="text-sm text-zinc-500 mt-0.5">{subtitle}</p>
                        )}
                      </div>
                      <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
                      </svg>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </main>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- "__tests__/app/(app)/\[orgSlug\]/shows/page.test.tsx"
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/[orgSlug]/shows/page.tsx" "__tests__/app/(app)/[orgSlug]/shows/page.test.tsx"
git commit -m "feat: add shows list page with season grouping"
```

---

## Task 6: Show detail page

**Files:**

- Create: `app/(app)/[orgSlug]/shows/[showSlug]/page.tsx`
- Create: `__tests__/app/(app)/[orgSlug]/shows/[showSlug]/page.test.tsx`

- [ ] **Step 1: Write failing test**

Create `__tests__/app/(app)/[orgSlug]/shows/[showSlug]/page.test.tsx`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ShowDetail } from '@/lib/data/shows'

const org = {
  id: '1', name: 'State U Theater', slug: 'state-u-theater',
  settings: { claude_enabled: false }, createdAt: '2026-01-01',
}

const mockShow: ShowDetail = {
  id: '1', name: 'Hamlet', slug: 'hamlet', orgId: org.id,
  seasonId: 's1', approvalMode: 'multi', allowReopen: true,
  createdAt: '2026-01-01',
  season: { name: '2025–26 Season', slug: '2025-26' },
  departments: [
    { id: 'd1', name: 'Scenic Design', created_at: '2026-01-01' },
    { id: 'd2', name: 'Costume Design', created_at: '2026-01-01' },
  ],
  show_members: [
    {
      id: 'm1', featured: true,
      profiles: { display_name: 'Antoni Cimolino' },
      role_definitions: { name: 'Director' },
    },
    {
      id: 'm2', featured: false,
      profiles: { display_name: 'Jane Smith' },
      role_definitions: { name: 'Set Designer' },
    },
  ],
}

vi.mock('@/lib/data/orgs', () => ({ getOrgBySlug: vi.fn().mockResolvedValue(org) }))
vi.mock('@/lib/data/shows', () => ({ getShowBySlug: vi.fn().mockResolvedValue(mockShow) }))

describe('ShowDetailPage', () => {
  it('renders show name', async () => {
    const { default: ShowDetailPage } = await import('@/app/(app)/[orgSlug]/shows/[showSlug]/page')
    const jsx = await ShowDetailPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet' }),
    })
    render(jsx)
    expect(screen.getByText('Hamlet')).toBeInTheDocument()
  })

  it('renders department names', async () => {
    const { default: ShowDetailPage } = await import('@/app/(app)/[orgSlug]/shows/[showSlug]/page')
    const jsx = await ShowDetailPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet' }),
    })
    render(jsx)
    expect(screen.getByText('Scenic Design')).toBeInTheDocument()
    expect(screen.getByText('Costume Design')).toBeInTheDocument()
  })

  it('renders member names and roles', async () => {
    const { default: ShowDetailPage } = await import('@/app/(app)/[orgSlug]/shows/[showSlug]/page')
    const jsx = await ShowDetailPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet' }),
    })
    render(jsx)
    expect(screen.getByText('Antoni Cimolino')).toBeInTheDocument()
    expect(screen.getByText('Director')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
npm test -- "__tests__/app/(app)/\[orgSlug\]/shows/\[showSlug\]/page.test.tsx"
```

Expected: FAIL — `Cannot find module '@/app/(app)/[orgSlug]/shows/[showSlug]/page'`

- [ ] **Step 3: Implement the show detail page**

Create `app/(app)/[orgSlug]/shows/[showSlug]/page.tsx`:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrgBySlug } from '@/lib/data/orgs'
import { getShowBySlug } from '@/lib/data/shows'

type Props = {
  params: Promise<{ orgSlug: string; showSlug: string }>
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export default async function ShowDetailPage({ params }: Props) {
  const { orgSlug, showSlug } = await params
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  const show = await getShowBySlug(org, showSlug)
  if (!show) notFound()

  const featuredMember = show.show_members.find((m) => m.featured)

  return (
    <div>
      {/* Breadcrumb + header */}
      <div className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
        <nav className="flex items-center gap-2 text-sm text-zinc-500 mb-2">
          <Link href={`/${orgSlug}/shows`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            {org.name}
          </Link>
          <span>/</span>
          <Link href={`/${orgSlug}/shows`} className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Shows
          </Link>
          <span>/</span>
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">{show.name}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{show.name}</h1>
        <p className="text-sm text-zinc-500 mt-1">
          {[show.season?.name, featuredMember?.profiles?.display_name]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>

      {/* Two-column body */}
      <div className="flex">
        {/* Members (left) */}
        <aside className="w-64 shrink-0 border-r border-zinc-200 dark:border-zinc-800 p-6">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-4">Members</p>
          <ul className="flex flex-col gap-3">
            {show.show_members.map((member) => (
              <li key={member.id} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
                  {initials(member.profiles?.display_name)}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {member.profiles?.display_name ?? 'Unknown'}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {member.role_definitions?.name ?? '—'}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        {/* Departments (right) */}
        <main className="flex-1 p-6">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 mb-4">Departments</p>
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {show.departments.map((dept) => (
              <li
                key={dept.id}
                className="flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                {dept.name}
              </li>
            ))}
          </ul>
        </main>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- "__tests__/app/(app)/\[orgSlug\]/shows/\[showSlug\]/page.test.tsx"
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/[orgSlug]/shows/[showSlug]/page.tsx" "__tests__/app/(app)/[orgSlug]/shows/[showSlug]/page.test.tsx"
git commit -m "feat: add show detail page with members and departments"
```

---

## Task 7: Update dashboard links

**Files:**

- Modify: `app/(app)/dashboard/page.tsx`
- Modify: `__tests__/app/(app)/dashboard/page.test.tsx`

- [ ] **Step 1: Update the dashboard test to assert links**

Replace `__tests__/app/(app)/dashboard/page.test.tsx`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Org } from '@/lib/types/domain'

const mockOrgs: Org[] = [
  {
    id: '1', name: 'State University Theater', slug: 'state-u-theater',
    settings: { claude_enabled: false }, createdAt: '2026-01-01',
  },
  {
    id: '2', name: 'Riverside Regional', slug: 'riverside-regional',
    settings: { claude_enabled: false }, createdAt: '2026-01-01',
  },
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

  it('links each org to its shows page', async () => {
    const { default: DashboardPage } = await import('@/app/(app)/dashboard/page')
    const jsx = await DashboardPage()
    render(jsx)
    const link = screen.getByRole('link', { name: 'State University Theater' })
    expect(link).toHaveAttribute('href', '/state-u-theater/shows')
  })
})
```

- [ ] **Step 2: Run to verify new assertion fails**

```bash
npm test -- __tests__/app/\(app\)/dashboard/page.test.tsx
```

Expected: FAIL — `links each org to its shows page` (no link rendered yet)

- [ ] **Step 3: Update the dashboard page**

Replace `app/(app)/dashboard/page.tsx`:

```tsx
import Link from 'next/link'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Org } from '@/lib/types/domain'

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient()
  const { data: orgs } = await supabase.from('orgs').select('*')

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold mb-4">Your Organizations</h1>
      <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        {((orgs ?? []) as Org[]).map((org) => (
          <li key={org.id}>
            <Link
              href={`/${org.slug}/shows`}
              className="flex items-center justify-between px-4 py-3.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              {org.name}
              <svg className="h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6" />
              </svg>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test
```

Expected: all PASS.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/dashboard/page.tsx __tests__/app/\(app\)/dashboard/page.test.tsx
git commit -m "feat: link dashboard orgs to shows page"
```

---

## Task 8: Update spec and PLAN.md

**Files:**

- Modify: `PLAN.md`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Update `PLAN.md`**

Change the Plan 2 row from `Not started` to `Complete` and fill in the plan file path:

```markdown
| 2 | Data hierarchy + Flexible roles | Complete | `docs/plans/2026-05-09-plan-2-data-hierarchy-roles.md` |
```

- [ ] **Step 2: Update `ARCHITECTURE.md`**

Change the Plan 2 row in the Implementation Plans table:

```markdown
| 2 | Data hierarchy + Flexible roles | `docs/plans/2026-05-09-plan-2-data-hierarchy-roles.md` |
```

- [ ] **Step 3: Commit**

```bash
git add PLAN.md ARCHITECTURE.md
git commit -m "chore: mark Plan 2 complete in PLAN.md and ARCHITECTURE.md"
```
