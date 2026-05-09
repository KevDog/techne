# Plan 3: Materials + Annealing Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `materials` table, department slugs, annealing state machine, Supabase Storage integration, and the department page with upload/detail slide-overs.

**Architecture:** A Supabase migration adds `slug` to `departments` and creates the `materials` table with RLS. The browser uploads files directly to a private Supabase Storage bucket; a Server Action writes the DB record afterward. The department page is a Server Component that renders a `DepartmentClient` island for all interactive behavior (tabs, slide-overs, state transitions).

**Tech Stack:** Next.js 16 App Router, Supabase Postgres + RLS, Supabase Storage (private bucket), React Server Components, Server Actions (`'use server'`), `React.cache()`, Vitest + Testing Library

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/20260509100000_plan_3_materials.sql` | Create | departments.slug + materials table + RLS + storage bucket |
| `supabase/seed.sql` | Modify | add slug values to departments insert |
| `lib/types/domain.ts` | Modify | add slug to Department; add MaterialType, MaterialState, Material |
| `lib/types/db.ts` | Modify | add slug to departments; add materials table Row/Insert/Update |
| `lib/data/shows.ts` | Modify | ShowDetail.departments gets slug; getShowBySlug query selects slug |
| `app/(app)/[orgSlug]/shows/[showSlug]/page.tsx` | Modify | dept `<li>` → `<Link>` |
| `__tests__/app/(app)/[orgSlug]/shows/[showSlug]/page.test.tsx` | Modify | add slug to fixtures; add link test |
| `lib/data/departments.ts` | Create | getDepartmentBySlug |
| `__tests__/lib/data/departments.test.ts` | Create | unit tests |
| `lib/data/materials.ts` | Create | getMaterialsByDepartment + MaterialWithUrl |
| `__tests__/lib/data/materials.test.ts` | Create | unit tests |
| `lib/actions/materials.ts` | Create | createMaterial, transitionState, updateTags, deleteMaterial, isValidTransition |
| `__tests__/lib/actions/materials.test.ts` | Create | unit tests |
| `app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.tsx` | Create | department Server Component page |
| `__tests__/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.test.tsx` | Create | unit tests |
| `app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/DepartmentClient.tsx` | Create | Client Component island: tabs, list, upload + detail slide-overs |
| `PLAN.md` | Modify | mark Plan 3 complete |
| `ARCHITECTURE.md` | Modify | add materials layer description |

---

### Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260509100000_plan_3_materials.sql`
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/20260509100000_plan_3_materials.sql

-- ── departments.slug ──────────────────────────────────────────────────────────

alter table public.departments
  add column slug text;

update public.departments
  set slug = lower(trim(both '-' from regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')));

alter table public.departments
  alter column slug set not null;

alter table public.departments
  add constraint departments_show_id_slug_key unique (show_id, slug);

-- ── materials ─────────────────────────────────────────────────────────────────

create table public.materials (
  id             uuid primary key default gen_random_uuid(),
  department_id  uuid not null references public.departments(id) on delete cascade,
  uploaded_by    uuid not null references public.profiles(id) on delete restrict,
  type           text not null check (type in ('image', 'file', 'link', 'note')),
  state          text not null default 'exploratory' check (state in ('exploratory', 'proposed', 'decided')),
  title          text not null,
  description    text,
  url            text,
  storage_path   text,
  body           text,
  tags           text[] not null default '{}',
  created_at     timestamptz not null default now()
);

create index materials_department_id_idx on public.materials(department_id);
create index materials_uploaded_by_idx   on public.materials(uploaded_by);
create index materials_state_idx         on public.materials(state);

alter table public.materials enable row level security;

create policy "org members can select materials"
  on public.materials for select
  using (
    exists (
      select 1 from public.departments d
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where d.id = materials.department_id
        and om.user_id = auth.uid()
    )
  );

create policy "org members can insert materials"
  on public.materials for insert
  with check (
    exists (
      select 1 from public.departments d
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where d.id = materials.department_id
        and om.user_id = auth.uid()
    )
  );

create policy "org members can update materials"
  on public.materials for update
  using (
    exists (
      select 1 from public.departments d
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where d.id = materials.department_id
        and om.user_id = auth.uid()
    )
  );

create policy "uploaders can delete materials"
  on public.materials for delete
  using (uploaded_by = auth.uid());

-- ── storage bucket ────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('materials', 'materials', false)
  on conflict (id) do nothing;

create policy "org members can upload material files"
  on storage.objects for insert
  with check (
    bucket_id = 'materials'
    and exists (
      select 1 from public.org_members
      where org_id = (storage.foldername(name))[1]::uuid
        and user_id = auth.uid()
    )
  );

create policy "org members can read material files"
  on storage.objects for select
  using (
    bucket_id = 'materials'
    and exists (
      select 1 from public.org_members
      where org_id = (storage.foldername(name))[1]::uuid
        and user_id = auth.uid()
    )
  );

create policy "org members can delete material files"
  on storage.objects for delete
  using (
    bucket_id = 'materials'
    and exists (
      select 1 from public.org_members
      where org_id = (storage.foldername(name))[1]::uuid
        and user_id = auth.uid()
    )
  );
```

- [ ] **Step 2: Update seed.sql — add slug to departments insert**

Replace the departments insert block in `supabase/seed.sql`:

```sql
-- Departments
insert into public.departments (id, show_id, name, slug) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Scenic Design',   'scenic-design'),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'Costume Design',  'costume-design'),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'Lighting Design', 'lighting-design'),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Scenic Design',   'scenic-design'),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'Costume Design',  'costume-design'),
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 'Scenic Design',   'scenic-design'),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000004', 'Costume Design',  'costume-design');
```

- [ ] **Step 3: Verify migration parses (no DB required)**

```bash
grep -c 'create policy' supabase/migrations/20260509100000_plan_3_materials.sql
```

Expected output: `7`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260509100000_plan_3_materials.sql supabase/seed.sql
git commit -m "feat: add materials table, department slugs, RLS, and storage bucket"
```

---

### Task 2: TypeScript Types

**Files:**
- Modify: `lib/types/domain.ts`
- Modify: `lib/types/db.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/types/domain.test.ts
import { describe, it, expectTypeOf } from 'vitest'
import type { Department, Material, MaterialType, MaterialState } from '@/lib/types/domain'

describe('domain types', () => {
  it('Department has slug', () => {
    expectTypeOf<Department>().toMatchTypeOf<{ slug: string }>()
  })

  it('Material has required fields', () => {
    expectTypeOf<Material>().toMatchTypeOf<{
      id: string
      departmentId: string
      uploadedBy: string
      type: MaterialType
      state: MaterialState
      title: string
      tags: string[]
    }>()
  })

  it('MaterialState covers all states', () => {
    const s: MaterialState = 'exploratory'
    expectTypeOf(s).toEqualTypeOf<'exploratory' | 'proposed' | 'decided'>()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/types/domain.test.ts
```

Expected: FAIL — `slug` not in `Department`, `Material` not exported

- [ ] **Step 3: Update `lib/types/domain.ts`**

Add `slug` to `Department` and append the new types:

```typescript
export type Department = {
  id: string
  showId: string
  name: string
  slug: string
  createdAt: string
}

export type MaterialType = 'image' | 'file' | 'link' | 'note'
export type MaterialState = 'exploratory' | 'proposed' | 'decided'

export type Material = {
  id: string
  departmentId: string
  uploadedBy: string
  type: MaterialType
  state: MaterialState
  title: string
  description: string | null
  url: string | null
  storagePath: string | null
  body: string | null
  tags: string[]
  createdAt: string
}
```

- [ ] **Step 4: Update `lib/types/db.ts` — departments table**

Replace the `departments` table entry:

```typescript
departments: {
  Row: {
    id: string
    show_id: string
    name: string
    slug: string
    created_at: string
  }
  Insert: {
    id?: string
    show_id: string
    name: string
    slug: string
    created_at?: string
  }
  Update: {
    id?: string
    show_id?: string
    name?: string
    slug?: string
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
```

- [ ] **Step 5: Update `lib/types/db.ts` — add materials table**

Add the `materials` entry to the `Tables` object (after `departments`):

```typescript
materials: {
  Row: {
    id: string
    department_id: string
    uploaded_by: string
    type: string
    state: string
    title: string
    description: string | null
    url: string | null
    storage_path: string | null
    body: string | null
    tags: string[]
    created_at: string
  }
  Insert: {
    id?: string
    department_id: string
    uploaded_by: string
    type: string
    state?: string
    title: string
    description?: string | null
    url?: string | null
    storage_path?: string | null
    body?: string | null
    tags?: string[]
    created_at?: string
  }
  Update: {
    id?: string
    department_id?: string
    uploaded_by?: string
    type?: string
    state?: string
    title?: string
    description?: string | null
    url?: string | null
    storage_path?: string | null
    body?: string | null
    tags?: string[]
    created_at?: string
  }
  Relationships: [
    {
      foreignKeyName: "materials_department_id_fkey"
      columns: ["department_id"]
      isOneToOne: false
      referencedRelation: "departments"
      referencedColumns: ["id"]
    },
    {
      foreignKeyName: "materials_uploaded_by_fkey"
      columns: ["uploaded_by"]
      isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
  ]
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run __tests__/lib/types/domain.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add lib/types/domain.ts lib/types/db.ts __tests__/lib/types/domain.test.ts
git commit -m "feat: add slug to Department type and add Material types"
```

---

### Task 3: Update Shows Data Layer + Show Detail Page

**Files:**
- Modify: `lib/data/shows.ts`
- Modify: `app/(app)/[orgSlug]/shows/[showSlug]/page.tsx`
- Modify: `__tests__/app/(app)/[orgSlug]/shows/[showSlug]/page.test.tsx`

- [ ] **Step 1: Write the failing test**

In `__tests__/app/(app)/[orgSlug]/shows/[showSlug]/page.test.tsx`, add `slug` to department fixtures and a new link test:

```typescript
// Replace the departments array in mockShow:
departments: [
  { id: 'd1', name: 'Scenic Design',  slug: 'scenic-design',  created_at: '2026-01-01' },
  { id: 'd2', name: 'Costume Design', slug: 'costume-design', created_at: '2026-01-01' },
],
```

Add a new test case at the end of the `describe` block:

```typescript
it('renders department links', async () => {
  const { default: ShowDetailPage } = await import('@/app/(app)/[orgSlug]/shows/[showSlug]/page')
  const jsx = await ShowDetailPage({
    params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet' }),
  })
  render(jsx)
  const link = screen.getByRole('link', { name: 'Scenic Design' })
  expect(link).toHaveAttribute('href', '/state-u-theater/shows/hamlet/departments/scenic-design')
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/app/\(app\)/\[orgSlug\]/shows/\[showSlug\]/page.test.tsx
```

Expected: FAIL — fixture type error (slug missing) and no link rendered

- [ ] **Step 3: Update `lib/data/shows.ts`**

Change `ShowDetail` type and update the query to select `slug`:

```typescript
export type ShowDetail = ShowWithRelations & {
  departments: { id: string; name: string; slug: string; created_at: string }[]
}
```

Update `getShowBySlug` — change the departments select line:

```typescript
departments ( id, name, slug, created_at ),
```

Update the `departments` cast in the return:

```typescript
departments: (data.departments as ShowDetail['departments']) ?? [],
```

- [ ] **Step 4: Update `app/(app)/[orgSlug]/shows/[showSlug]/page.tsx`**

Replace the department `<li>` with a `<Link>`:

```tsx
{show.departments.map((dept) => (
  <li key={dept.id}>
    <Link
      href={`/${orgSlug}/shows/${showSlug}/departments/${dept.slug}`}
      className="flex items-center justify-between px-4 py-3 text-sm font-medium text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-900"
    >
      {dept.name}
    </Link>
  </li>
))}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run __tests__/app/\(app\)/\[orgSlug\]/shows/\[showSlug\]/page.test.tsx
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/data/shows.ts app/\(app\)/\[orgSlug\]/shows/\[showSlug\]/page.tsx __tests__/app/\(app\)/\[orgSlug\]/shows/\[showSlug\]/page.test.tsx
git commit -m "feat: add slug to ShowDetail.departments and make dept rows navigable links"
```

---

### Task 4: Data Access — Departments

**Files:**
- Create: `lib/data/departments.ts`
- Create: `__tests__/lib/data/departments.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/data/departments.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Show } from '@/lib/types/domain'

const mockShow: Show = {
  id: 'show-1', orgId: 'org-1', seasonId: null, name: 'Hamlet', slug: 'hamlet',
  approvalMode: 'single', allowReopen: false, createdAt: '2026-01-01',
}

const mockDeptRow = {
  id: 'dept-1', show_id: 'show-1', name: 'Lighting Design', slug: 'lighting-design',
  created_at: '2026-01-01',
}

const mockSingle = vi.fn()
const mockEq = vi.fn(() => ({ eq: mockEq, single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))
const mockSupabase = { from: mockFrom }

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue(mockSupabase),
}))

describe('getDepartmentBySlug', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns null when not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })
    const { getDepartmentBySlug } = await import('@/lib/data/departments')
    const result = await getDepartmentBySlug(mockShow, 'missing')
    expect(result).toBeNull()
  })

  it('returns Department when found', async () => {
    mockSingle.mockResolvedValue({ data: mockDeptRow, error: null })
    const { getDepartmentBySlug } = await import('@/lib/data/departments')
    const result = await getDepartmentBySlug(mockShow, 'lighting-design')
    expect(result).toEqual({
      id: 'dept-1',
      showId: 'show-1',
      name: 'Lighting Design',
      slug: 'lighting-design',
      createdAt: '2026-01-01',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/data/departments.test.ts
```

Expected: FAIL — module `@/lib/data/departments` not found

- [ ] **Step 3: Implement `lib/data/departments.ts`**

```typescript
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Show, Department } from '@/lib/types/domain'

export const getDepartmentBySlug = cache(
  async (show: Show, slug: string): Promise<Department | null> => {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('departments')
      .select('id, show_id, name, slug, created_at')
      .eq('show_id', show.id)
      .eq('slug', slug)
      .single()
    if (error || !data) return null
    return {
      id: data.id,
      showId: data.show_id,
      name: data.name,
      slug: data.slug,
      createdAt: data.created_at,
    }
  }
)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/lib/data/departments.test.ts
```

Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/data/departments.ts __tests__/lib/data/departments.test.ts
git commit -m "feat: add getDepartmentBySlug data access function"
```

---

### Task 5: Data Access — Materials

**Files:**
- Create: `lib/data/materials.ts`
- Create: `__tests__/lib/data/materials.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/data/materials.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Department } from '@/lib/types/domain'

const mockDept: Department = {
  id: 'dept-1', showId: 'show-1', name: 'Lighting Design', slug: 'lighting-design',
  createdAt: '2026-01-01',
}

const mockImageRow = {
  id: 'm-1', department_id: 'dept-1', uploaded_by: 'user-1',
  type: 'image', state: 'exploratory', title: 'Final Plot',
  description: null, url: null, storage_path: 'org-1/show-1/dept-1/uuid/plot.jpg',
  body: null, tags: ['act-1'], created_at: '2026-05-09',
}

const mockNoteRow = {
  id: 'm-2', department_id: 'dept-1', uploaded_by: 'user-1',
  type: 'note', state: 'proposed', title: 'Concept note',
  description: null, url: null, storage_path: null,
  body: 'Warmth vs cold', tags: [], created_at: '2026-05-09',
}

const mockCreateSignedUrl = vi.fn()
const mockStorage = { from: vi.fn(() => ({ createSignedUrl: mockCreateSignedUrl })) }
const mockOrder = vi.fn()
const mockEq = vi.fn(() => ({ order: mockOrder }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))
const mockFrom = vi.fn(() => ({ select: mockSelect }))
const mockSupabase = { from: mockFrom, storage: mockStorage }

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue(mockSupabase),
}))

describe('getMaterialsByDepartment', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('returns empty array on error', async () => {
    mockOrder.mockResolvedValue({ data: null, error: { message: 'fail' } })
    const { getMaterialsByDepartment } = await import('@/lib/data/materials')
    const result = await getMaterialsByDepartment(mockDept)
    expect(result).toEqual([])
  })

  it('generates signed URL for image type', async () => {
    mockOrder.mockResolvedValue({ data: [mockImageRow], error: null })
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
    })
    const { getMaterialsByDepartment } = await import('@/lib/data/materials')
    const result = await getMaterialsByDepartment(mockDept)
    expect(result[0].signedUrl).toBe('https://example.com/signed')
  })

  it('sets signedUrl to null for note type', async () => {
    mockOrder.mockResolvedValue({ data: [mockNoteRow], error: null })
    const { getMaterialsByDepartment } = await import('@/lib/data/materials')
    const result = await getMaterialsByDepartment(mockDept)
    expect(result[0].signedUrl).toBeNull()
    expect(mockCreateSignedUrl).not.toHaveBeenCalled()
  })

  it('maps row fields to camelCase Material', async () => {
    mockOrder.mockResolvedValue({ data: [mockNoteRow], error: null })
    const { getMaterialsByDepartment } = await import('@/lib/data/materials')
    const result = await getMaterialsByDepartment(mockDept)
    expect(result[0]).toMatchObject({
      id: 'm-2',
      departmentId: 'dept-1',
      uploadedBy: 'user-1',
      type: 'note',
      state: 'proposed',
      title: 'Concept note',
      body: 'Warmth vs cold',
      tags: [],
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/data/materials.test.ts
```

Expected: FAIL — module `@/lib/data/materials` not found

- [ ] **Step 3: Implement `lib/data/materials.ts`**

```typescript
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Department, Material, MaterialType, MaterialState } from '@/lib/types/domain'

export type MaterialWithUrl = Material & { signedUrl: string | null }

export const getMaterialsByDepartment = cache(
  async (dept: Department): Promise<MaterialWithUrl[]> => {
    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('materials')
      .select('*')
      .eq('department_id', dept.id)
      .order('created_at', { ascending: false })
    if (error || !data) return []

    return Promise.all(
      data.map(async (row) => {
        const material: Material = {
          id: row.id,
          departmentId: row.department_id,
          uploadedBy: row.uploaded_by,
          type: row.type as MaterialType,
          state: row.state as MaterialState,
          title: row.title,
          description: row.description,
          url: row.url,
          storagePath: row.storage_path,
          body: row.body,
          tags: row.tags ?? [],
          createdAt: row.created_at,
        }

        let signedUrl: string | null = null
        if (row.storage_path && (row.type === 'image' || row.type === 'file')) {
          const { data: urlData } = await supabase.storage
            .from('materials')
            .createSignedUrl(row.storage_path, 3600)
          signedUrl = urlData?.signedUrl ?? null
        }

        return { ...material, signedUrl }
      })
    )
  }
)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/lib/data/materials.test.ts
```

Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/data/materials.ts __tests__/lib/data/materials.test.ts
git commit -m "feat: add getMaterialsByDepartment with signed URL generation"
```

---

### Task 6: Server Actions — Materials

**Files:**
- Create: `lib/actions/materials.ts`
- Create: `__tests__/lib/actions/materials.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/actions/materials.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── isValidTransition (pure — no mocks needed) ─────────────────────────────

describe('isValidTransition', () => {
  it('exploratory → proposed: allowed', async () => {
    const { isValidTransition } = await import('@/lib/actions/materials')
    expect(isValidTransition('exploratory', 'proposed', false)).toBe(true)
  })

  it('proposed → decided: allowed', async () => {
    const { isValidTransition } = await import('@/lib/actions/materials')
    expect(isValidTransition('proposed', 'decided', false)).toBe(true)
  })

  it('decided → proposed with allowReopen=true: allowed', async () => {
    const { isValidTransition } = await import('@/lib/actions/materials')
    expect(isValidTransition('decided', 'proposed', true)).toBe(true)
  })

  it('decided → proposed with allowReopen=false: blocked', async () => {
    const { isValidTransition } = await import('@/lib/actions/materials')
    expect(isValidTransition('decided', 'proposed', false)).toBe(false)
  })

  it('proposed → exploratory: never allowed', async () => {
    const { isValidTransition } = await import('@/lib/actions/materials')
    expect(isValidTransition('proposed', 'exploratory', true)).toBe(false)
  })

  it('exploratory → decided: never allowed', async () => {
    const { isValidTransition } = await import('@/lib/actions/materials')
    expect(isValidTransition('exploratory', 'decided', false)).toBe(false)
  })
})

// ── transitionState ────────────────────────────────────────────────────────

const mockMaterialSingle = vi.fn()
const mockDeptSingle = vi.fn()
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null })
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }))

const mockFromImpl = vi.fn((table: string) => {
  if (table === 'materials') {
    return {
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockMaterialSingle })) })),
      update: mockUpdate,
    }
  }
  if (table === 'departments') {
    return {
      select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockDeptSingle })) })),
    }
  }
  return {}
})

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({ from: mockFromImpl }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('transitionState', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('throws on invalid transition', async () => {
    mockMaterialSingle.mockResolvedValue({
      data: { state: 'proposed', department_id: 'dept-1' },
      error: null,
    })
    mockDeptSingle.mockResolvedValue({
      data: { show_id: 'show-1', shows: { allow_reopen: false } },
      error: null,
    })
    const { transitionState } = await import('@/lib/actions/materials')
    await expect(transitionState('mat-1', 'exploratory')).rejects.toThrow('Invalid state transition')
  })

  it('updates state on valid transition', async () => {
    mockMaterialSingle.mockResolvedValue({
      data: { state: 'exploratory', department_id: 'dept-1' },
      error: null,
    })
    mockDeptSingle.mockResolvedValue({
      data: { show_id: 'show-1', shows: { allow_reopen: false } },
      error: null,
    })
    const { transitionState } = await import('@/lib/actions/materials')
    await transitionState('mat-1', 'proposed')
    expect(mockUpdate).toHaveBeenCalledWith({ state: 'proposed' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run __tests__/lib/actions/materials.test.ts
```

Expected: FAIL — module `@/lib/actions/materials` not found

- [ ] **Step 3: Implement `lib/actions/materials.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { MaterialType, MaterialState } from '@/lib/types/domain'

export function isValidTransition(
  from: MaterialState,
  to: MaterialState,
  allowReopen: boolean
): boolean {
  if (from === 'exploratory' && to === 'proposed') return true
  if (from === 'proposed' && to === 'decided') return true
  if (from === 'decided' && to === 'proposed') return allowReopen
  return false
}

export async function createMaterial(
  deptId: string,
  type: MaterialType,
  data: {
    title: string
    description?: string
    url?: string
    storagePath?: string
    body?: string
    tags?: string[]
  }
): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: row, error } = await supabase
    .from('materials')
    .insert({
      department_id: deptId,
      uploaded_by: user.id,
      type,
      title: data.title,
      description: data.description ?? null,
      url: data.url ?? null,
      storage_path: data.storagePath ?? null,
      body: data.body ?? null,
      tags: data.tags ?? [],
    })
    .select('id')
    .single()
  if (error || !row) throw new Error(error?.message ?? 'Insert failed')

  revalidatePath('', 'layout')
  return { id: row.id }
}

export async function transitionState(
  materialId: string,
  targetState: MaterialState
): Promise<void> {
  const supabase = await createSupabaseServerClient()

  const { data: material, error: mErr } = await supabase
    .from('materials')
    .select('state, department_id')
    .eq('id', materialId)
    .single()
  if (mErr || !material) throw new Error('Material not found')

  const { data: dept, error: dErr } = await supabase
    .from('departments')
    .select('show_id, shows!inner(allow_reopen)')
    .eq('id', material.department_id)
    .single()
  if (dErr || !dept) throw new Error('Department not found')

  const allowReopen = (dept.shows as { allow_reopen: boolean }).allow_reopen

  if (!isValidTransition(material.state as MaterialState, targetState, allowReopen)) {
    throw new Error(`Invalid state transition: ${material.state} → ${targetState}`)
  }

  const { error } = await supabase
    .from('materials')
    .update({ state: targetState })
    .eq('id', materialId)
  if (error) throw new Error(error.message)

  revalidatePath('', 'layout')
}

export async function updateTags(
  materialId: string,
  tags: string[]
): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { error } = await supabase
    .from('materials')
    .update({ tags })
    .eq('id', materialId)
  if (error) throw new Error(error.message)
  revalidatePath('', 'layout')
}

export async function deleteMaterial(materialId: string): Promise<void> {
  const supabase = await createSupabaseServerClient()

  const { data: material, error: mErr } = await supabase
    .from('materials')
    .select('storage_path, uploaded_by')
    .eq('id', materialId)
    .single()
  if (mErr || !material) throw new Error('Material not found')

  const { data: { user } } = await supabase.auth.getUser()
  if (material.uploaded_by !== user?.id) throw new Error('Unauthorized')

  if (material.storage_path) {
    await supabase.storage.from('materials').remove([material.storage_path])
  }

  const { error } = await supabase.from('materials').delete().eq('id', materialId)
  if (error) throw new Error(error.message)

  revalidatePath('', 'layout')
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/lib/actions/materials.test.ts
```

Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/actions/materials.ts __tests__/lib/actions/materials.test.ts
git commit -m "feat: add materials server actions and isValidTransition state machine"
```

---

### Task 7: Department Page (Server Component)

**Files:**
- Create: `app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.tsx`
- Create: `__tests__/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { ShowDetail } from '@/lib/data/shows'
import type { Department } from '@/lib/types/domain'
import type { MaterialWithUrl } from '@/lib/data/materials'

const org = {
  id: 'org-1', name: 'State U Theater', slug: 'state-u-theater',
  settings: { claudeEnabled: false }, createdAt: '2026-01-01',
}

const mockShow: ShowDetail = {
  id: 'show-1', name: 'Hamlet', slug: 'hamlet', orgId: 'org-1',
  seasonId: null, approvalMode: 'single', allowReopen: false,
  createdAt: '2026-01-01', season: null,
  departments: [{ id: 'dept-1', name: 'Lighting Design', slug: 'lighting-design', created_at: '2026-01-01' }],
  show_members: [],
}

const mockDept: Department = {
  id: 'dept-1', showId: 'show-1', name: 'Lighting Design', slug: 'lighting-design',
  createdAt: '2026-01-01',
}

const mockMaterials: MaterialWithUrl[] = []

vi.mock('@/lib/data/orgs', () => ({ getOrgBySlug: vi.fn().mockResolvedValue(org) }))
vi.mock('@/lib/data/shows', () => ({ getShowBySlug: vi.fn().mockResolvedValue(mockShow) }))
vi.mock('@/lib/data/departments', () => ({ getDepartmentBySlug: vi.fn().mockResolvedValue(mockDept) }))
vi.mock('@/lib/data/materials', () => ({ getMaterialsByDepartment: vi.fn().mockResolvedValue(mockMaterials) }))
vi.mock(
  '@/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/DepartmentClient',
  () => ({ DepartmentClient: () => <div data-testid="dept-client" /> })
)

describe('DepartmentPage', () => {
  it('renders department name in heading', async () => {
    const { default: DepartmentPage } = await import(
      '@/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page'
    )
    const jsx = await DepartmentPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet', deptSlug: 'lighting-design' }),
    })
    render(jsx)
    expect(screen.getByRole('heading', { level: 1, name: 'Lighting Design' })).toBeInTheDocument()
  })

  it('renders breadcrumb with show link', async () => {
    const { default: DepartmentPage } = await import(
      '@/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page'
    )
    const jsx = await DepartmentPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet', deptSlug: 'lighting-design' }),
    })
    render(jsx)
    expect(screen.getByRole('link', { name: 'Hamlet' })).toHaveAttribute(
      'href', '/state-u-theater/shows/hamlet'
    )
  })

  it('renders DepartmentClient', async () => {
    const { default: DepartmentPage } = await import(
      '@/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page'
    )
    const jsx = await DepartmentPage({
      params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet', deptSlug: 'lighting-design' }),
    })
    render(jsx)
    expect(screen.getByTestId('dept-client')).toBeInTheDocument()
  })

  it('calls notFound when dept missing', async () => {
    const { getDepartmentBySlug } = await import('@/lib/data/departments')
    vi.mocked(getDepartmentBySlug).mockResolvedValueOnce(null)
    const { notFound } = await import('next/navigation')
    const { default: DepartmentPage } = await import(
      '@/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page'
    )
    await expect(
      DepartmentPage({ params: Promise.resolve({ orgSlug: 'state-u-theater', showSlug: 'hamlet', deptSlug: 'missing' }) })
    ).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run "__tests__/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.test.tsx"
```

Expected: FAIL — page module not found

- [ ] **Step 3: Implement the page**

Create directory:
```bash
mkdir -p "app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]"
```

```typescript
// app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrgBySlug } from '@/lib/data/orgs'
import { getShowBySlug } from '@/lib/data/shows'
import { getDepartmentBySlug } from '@/lib/data/departments'
import { getMaterialsByDepartment } from '@/lib/data/materials'
import { DepartmentClient } from './DepartmentClient'

type Props = {
  params: Promise<{ orgSlug: string; showSlug: string; deptSlug: string }>
}

export default async function DepartmentPage({ params }: Props) {
  const { orgSlug, showSlug, deptSlug } = await params

  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()

  const show = await getShowBySlug(org, showSlug)
  if (!show) notFound()

  const dept = await getDepartmentBySlug(show, deptSlug)
  if (!dept) notFound()

  const materials = await getMaterialsByDepartment(dept)

  return (
    <div>
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
          <Link
            href={`/${orgSlug}/shows/${showSlug}`}
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {show.name}
          </Link>
          <span>/</span>
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">{dept.name}</span>
        </nav>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{dept.name}</h1>
      </div>
      <DepartmentClient
        materials={materials}
        orgId={org.id}
        showId={show.id}
        deptId={dept.id}
        allowReopen={show.allowReopen}
      />
    </div>
  )
}
```

- [ ] **Step 4: Create a minimal `DepartmentClient` stub so the test can import it**

```typescript
// app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/DepartmentClient.tsx
'use client'

import type { MaterialWithUrl } from '@/lib/data/materials'

type Props = {
  materials: MaterialWithUrl[]
  orgId: string
  showId: string
  deptId: string
  allowReopen: boolean
}

export function DepartmentClient(_props: Props) {
  return <div>Loading…</div>
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run "__tests__/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.test.tsx"
```

Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.tsx" "app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/DepartmentClient.tsx" "__tests__/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.test.tsx"
git commit -m "feat: add department page server component with breadcrumb and DepartmentClient stub"
```

---

### Task 8: DepartmentClient — Interactive Island

**Files:**
- Modify: `app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/DepartmentClient.tsx`

No unit tests for this task — interaction testing is out of scope. Verify manually in the browser after implementation.

- [ ] **Step 1: Implement the full DepartmentClient**

```typescript
// app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/DepartmentClient.tsx
'use client'

import { useState, useTransition } from 'react'
import Image from 'next/image'
import { createMaterial, transitionState, updateTags, deleteMaterial } from '@/lib/actions/materials'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { MaterialWithUrl } from '@/lib/data/materials'
import type { MaterialType, MaterialState } from '@/lib/types/domain'

type Props = {
  materials: MaterialWithUrl[]
  orgId: string
  showId: string
  deptId: string
  allowReopen: boolean
}

type TabFilter = 'all' | MaterialState

const STATE_COLORS: Record<MaterialState, { bg: string; text: string }> = {
  exploratory: { bg: 'bg-indigo-900/50', text: 'text-indigo-300' },
  proposed:    { bg: 'bg-amber-900/50',  text: 'text-amber-300'  },
  decided:     { bg: 'bg-green-900/50',  text: 'text-green-300'  },
}

const TYPE_ICONS: Record<MaterialType, string> = {
  image: '🖼',
  file:  '📄',
  link:  '🔗',
  note:  '📝',
}

function StateBadge({ state }: { state: MaterialState }) {
  const { bg, text } = STATE_COLORS[state]
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${bg} ${text}`}>
      {state}
    </span>
  )
}

export function DepartmentClient({ materials, orgId, showId, deptId, allowReopen }: Props) {
  const [activeTab, setActiveTab] = useState<TabFilter>('all')
  const [selected, setSelected] = useState<MaterialWithUrl | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [, startTransition] = useTransition()

  const filtered = activeTab === 'all'
    ? materials
    : materials.filter((m) => m.state === activeTab)

  const counts = {
    all:         materials.length,
    decided:     materials.filter((m) => m.state === 'decided').length,
    proposed:    materials.filter((m) => m.state === 'proposed').length,
    exploratory: materials.filter((m) => m.state === 'exploratory').length,
  }

  function handleTransition(materialId: string, target: MaterialState) {
    startTransition(async () => {
      await transitionState(materialId, target)
      setSelected(null)
    })
  }

  function handleAddTag(materialId: string, currentTags: string[]) {
    const tag = newTag.trim()
    if (!tag) return
    startTransition(async () => {
      await updateTags(materialId, [...currentTags, tag])
      setNewTag('')
    })
  }

  function handleDelete(materialId: string) {
    startTransition(async () => {
      await deleteMaterial(materialId)
      setSelected(null)
    })
  }

  return (
    <div className="flex relative">
      {/* Main list */}
      <div className="flex-1 min-w-0">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex gap-0">
            {(['all', 'decided', 'proposed', 'exploratory'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-2 text-sm capitalize transition-colors ${
                  activeTab === tab
                    ? 'text-zinc-900 dark:text-zinc-100 border-b-2 border-indigo-500'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {tab === 'all' ? `All (${counts.all})` : `${tab.charAt(0).toUpperCase() + tab.slice(1)} (${counts[tab]})`}
              </button>
            ))}
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-500"
          >
            + Add Material
          </button>
        </div>

        {/* Materials list */}
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {filtered.length === 0 && (
            <li className="px-6 py-8 text-sm text-zinc-500 text-center">No materials yet.</li>
          )}
          {filtered.map((material) => (
            <li
              key={material.id}
              onClick={() => setSelected(material)}
              className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
            >
              {/* Thumbnail or icon */}
              <div className="shrink-0 w-12 h-12 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-800 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800 text-xl">
                {material.type === 'image' && material.signedUrl ? (
                  <Image
                    src={material.signedUrl}
                    alt={material.title}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  TYPE_ICONS[material.type]
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {material.title}
                  </span>
                  <StateBadge state={material.state} />
                  <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
                    {material.type}
                  </span>
                </div>
                {material.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {material.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="text-zinc-400 shrink-0">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </li>
          ))}
        </ul>
      </div>

      {/* Detail slide-over */}
      {selected && (
        <DetailPanel
          material={selected}
          allowReopen={allowReopen}
          newTag={newTag}
          onNewTagChange={setNewTag}
          onClose={() => setSelected(null)}
          onTransition={handleTransition}
          onAddTag={handleAddTag}
          onDelete={handleDelete}
        />
      )}

      {/* Upload slide-over */}
      {uploadOpen && (
        <UploadPanel
          orgId={orgId}
          showId={showId}
          deptId={deptId}
          onClose={() => setUploadOpen(false)}
        />
      )}
    </div>
  )
}

// ── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({
  material,
  allowReopen,
  newTag,
  onNewTagChange,
  onClose,
  onTransition,
  onAddTag,
  onDelete,
}: {
  material: MaterialWithUrl
  allowReopen: boolean
  newTag: string
  onNewTagChange: (v: string) => void
  onClose: () => void
  onTransition: (id: string, target: MaterialState) => void
  onAddTag: (id: string, tags: string[]) => void
  onDelete: (id: string) => void
}) {
  return (
    <aside className="w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800 p-5 overflow-y-auto bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
          {material.title}
        </h2>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-lg leading-none"
        >
          ✕
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <StateBadge state={material.state} />
        <span className="text-xs text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">
          {material.type}
        </span>
      </div>

      {/* Content area */}
      {material.type === 'image' && material.signedUrl && (
        <div className="mb-4 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
          <Image
            src={material.signedUrl}
            alt={material.title}
            width={300}
            height={200}
            className="w-full object-cover"
          />
        </div>
      )}
      {material.type === 'file' && material.signedUrl && (
        <a
          href={material.signedUrl}
          download
          className="mb-4 flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          📄 Download file
        </a>
      )}
      {material.type === 'link' && material.url && (
        <a
          href={material.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-4 flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline break-all"
        >
          🔗 {material.url}
        </a>
      )}
      {material.type === 'note' && material.body && (
        <p className="mb-4 text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">
          {material.body}
        </p>
      )}

      {/* Tags */}
      <div className="mb-4">
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">Tags</p>
        <div className="flex flex-wrap gap-1 mb-2">
          {material.tags.map((tag) => (
            <span key={tag} className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded">
              {tag}
            </span>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            value={newTag}
            onChange={(e) => onNewTagChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onAddTag(material.id, material.tags)
            }}
            placeholder="add tag…"
            className="flex-1 text-xs border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 bg-transparent text-zinc-900 dark:text-zinc-100"
          />
          <button
            onClick={() => onAddTag(material.id, material.tags)}
            className="text-xs text-indigo-600 dark:text-indigo-400 px-2"
          >
            +
          </button>
        </div>
      </div>

      {/* State transitions */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 pt-4 mb-4">
        <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">State</p>
        {material.state === 'exploratory' && (
          <button
            onClick={() => onTransition(material.id, 'proposed')}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Propose →
          </button>
        )}
        {material.state === 'proposed' && (
          <button
            onClick={() => onTransition(material.id, 'decided')}
            className="w-full rounded-md bg-green-600 px-3 py-2 text-sm text-white hover:bg-green-500"
          >
            Approve → Decided
          </button>
        )}
        {material.state === 'decided' && allowReopen && (
          <button
            onClick={() => onTransition(material.id, 'proposed')}
            className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 px-3 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
          >
            Reopen → Proposed
          </button>
        )}
      </div>

      {/* Delete */}
      <button
        onClick={() => onDelete(material.id)}
        className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
      >
        Delete material
      </button>
    </aside>
  )
}

// ── Upload Panel ──────────────────────────────────────────────────────────────

function UploadPanel({
  orgId,
  showId,
  deptId,
  onClose,
}: {
  orgId: string
  showId: string
  deptId: string
  onClose: () => void
}) {
  const [type, setType] = useState<MaterialType>('image')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [url, setUrl] = useState('')
  const [body, setBody] = useState('')
  const [tags, setTags] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setUploading(true)

    try {
      let storagePath: string | undefined

      if ((type === 'image' || type === 'file') && file) {
        const supabase = createSupabaseBrowserClient()
        const uploadUuid = crypto.randomUUID()
        storagePath = `${orgId}/${showId}/${deptId}/${uploadUuid}/${file.name}`
        const { error } = await supabase.storage.from('materials').upload(storagePath, file)
        if (error) throw error
      }

      await createMaterial(deptId, type, {
        title: title.trim(),
        description: description.trim() || undefined,
        url: type === 'link' ? url.trim() : undefined,
        storagePath,
        body: type === 'note' ? body.trim() : undefined,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      })

      onClose()
    } finally {
      setUploading(false)
    }
  }

  return (
    <aside className="w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800 p-5 overflow-y-auto bg-white dark:bg-zinc-900">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Add Material</h2>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-lg leading-none">✕</button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        {/* Type selector */}
        <div>
          <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Type</label>
          <div className="flex gap-1">
            {(['image', 'file', 'link', 'note'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 text-xs rounded capitalize ${
                  type === t
                    ? 'bg-indigo-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Conditional fields */}
        {(type === 'image' || type === 'file') && (
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">File</label>
            <input
              type="file"
              accept={type === 'image' ? 'image/*' : undefined}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="text-xs text-zinc-700 dark:text-zinc-300 w-full"
            />
          </div>
        )}
        {type === 'link' && (
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100"
            />
          </div>
        )}
        {type === 'note' && (
          <div>
            <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Note</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100 resize-none"
            />
          </div>
        )}

        {/* Title */}
        <div>
          <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="text-xs uppercase tracking-widest text-zinc-500 mb-1 block">Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="act-1, scenic, reference"
            className="w-full text-sm border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1.5 bg-transparent text-zinc-900 dark:text-zinc-100"
          />
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="mt-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Add Material'}
        </button>
      </form>
    </aside>
  )
}
```

- [ ] **Step 2: Run the full test suite to verify no regressions**

```bash
npx vitest run
```

Expected: all existing tests PASS

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/DepartmentClient.tsx"
git commit -m "feat: implement DepartmentClient with tabs, upload, and detail slide-overs"
```

---

### Task 9: Update PLAN.md and ARCHITECTURE.md

**Files:**
- Modify: `PLAN.md`
- Modify: `ARCHITECTURE.md`

- [ ] **Step 1: Mark Plan 3 complete in `PLAN.md`**

Find the Plan 3 entry and update its status to `✓ Complete`.

- [ ] **Step 2: Update `ARCHITECTURE.md` — add materials layer**

In the data model section, add:

```
materials         → belongs to department; type ∈ {image,file,link,note}; state machine: exploratory→proposed→decided
```

In the storage section, add:

```
Supabase Storage  → private bucket 'materials'; path {org_id}/{show_id}/{dept_id}/{uuid}/{filename}; browser-direct upload; signed URLs (1h TTL) generated server-side
```

- [ ] **Step 3: Commit**

```bash
git add PLAN.md ARCHITECTURE.md
git commit -m "docs: mark Plan 3 complete and update ARCHITECTURE.md with materials layer"
```

---

## Spec Coverage Checklist

| Spec Requirement | Task |
|---|---|
| departments.slug migration (add → backfill → not null → unique) | Task 1 |
| materials table with all columns + indexes | Task 1 |
| RLS: SELECT/INSERT/UPDATE org members | Task 1 |
| RLS: DELETE uploaded_by | Task 1 |
| Storage bucket `materials` (private) + RLS policies | Task 1 |
| seed.sql departments with slug values | Task 1 |
| MaterialType, MaterialState, Material types | Task 2 |
| Department type gets slug | Task 2 |
| db.ts: departments.slug, materials table | Task 2 |
| ShowDetail.departments gets slug | Task 3 |
| Show detail page: dept rows → Links | Task 3 |
| getDepartmentBySlug | Task 4 |
| getMaterialsByDepartment + MaterialWithUrl + signed URLs | Task 5 |
| createMaterial, transitionState, updateTags, deleteMaterial | Task 6 |
| isValidTransition pure helper | Task 6 |
| transitionState validates before updating | Task 6 |
| deleteMaterial removes Storage file | Task 6 |
| Department page Server Component | Task 7 |
| breadcrumb (Org / Shows / Show / Dept) | Task 7 |
| DepartmentClient: state tabs with counts | Task 8 |
| DepartmentClient: materials list (thumbnail for images, icons for others) | Task 8 |
| DepartmentClient: upload slide-over with type selector + conditional fields | Task 8 |
| DepartmentClient: detail slide-over with state transition buttons | Task 8 |
| DepartmentClient: inline tag add | Task 8 |
| PLAN.md + ARCHITECTURE.md updated | Task 9 |
