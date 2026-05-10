# Real-Time Meeting Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build live "follow the leader" design meetings — pre-scheduled meeting records, a shared light table with up to 4 resizable material panels, presenter handoff via request/yield, and per-meeting notes.

**Architecture:** Supabase holds permanent meeting records and notes; Liveblocks (one room per show, always-on) holds all ephemeral live state (presenter, material selection, panel sizes, filters). Server Actions write to Supabase only; clients write to Liveblocks directly after server calls complete. Presenter disconnect cleanup is performed by the oldest connected member (lowest `joined_at` in presence) to avoid concurrent writes.

**Tech Stack:** `@liveblocks/client`, `@liveblocks/react`, `@liveblocks/node` (auth endpoint), `react-resizable-panels`, Vitest + Testing Library, Supabase, Next.js 14 App Router.

---

## File Map

| Action | Path |
| --- | --- |
| CREATE | `supabase/migrations/20260509400000_plan_5_meetings.sql` |
| MODIFY | `lib/types/domain.ts` |
| MODIFY | `lib/types/db.ts` |
| CREATE | `lib/liveblocks.config.ts` |
| CREATE | `app/api/liveblocks-auth/route.ts` |
| CREATE | `lib/liveblocks/layout.ts` |
| CREATE | `lib/liveblocks/filters.ts` |
| CREATE | `lib/liveblocks/mutations.ts` |
| CREATE | `lib/data/meetings.ts` |
| MODIFY | `lib/data/notes.ts` |
| CREATE | `lib/actions/meetings.ts` |
| CREATE | `components/meetings/JoinPrompt.tsx` |
| CREATE | `components/meetings/MaterialPanel.tsx` |
| CREATE | `components/meetings/LightTable.tsx` |
| CREATE | `components/meetings/Filmstrip.tsx` |
| CREATE | `components/meetings/PresenceBar.tsx` |
| CREATE | `components/meetings/PresenterControls.tsx` |
| CREATE | `components/meetings/FollowBanner.tsx` |
| CREATE | `components/meetings/PresenterRequestToast.tsx` |
| CREATE | `components/meetings/NotesDrawer.tsx` |
| CREATE | `components/meetings/EndMeetingButton.tsx` |
| CREATE | `components/meetings/MeetingRoom.tsx` |
| CREATE | `app/(app)/[orgSlug]/shows/[showSlug]/meetings/page.tsx` |
| CREATE | `app/(app)/[orgSlug]/shows/[showSlug]/meetings/[meetingId]/page.tsx` |
| CREATE | `__tests__/lib/liveblocks/layout.test.ts` |
| CREATE | `__tests__/lib/liveblocks/filters.test.ts` |
| CREATE | `__tests__/lib/liveblocks/mutations.test.ts` |
| CREATE | `__tests__/lib/data/meetings.test.ts` |
| CREATE | `__tests__/lib/actions/meetings.test.ts` |
| CREATE | `__tests__/components/meetings/JoinPrompt.test.tsx` |
| CREATE | `__tests__/components/meetings/Filmstrip.test.tsx` |
| CREATE | `__tests__/components/meetings/PresenterControls.test.tsx` |
| CREATE | `__tests__/components/meetings/NotesDrawer.test.tsx` |
| CREATE | `__tests__/components/meetings/EndMeetingButton.test.tsx` |

---

## Task 1: Install dependencies

- [ ] **Step 1: Install runtime packages**

```bash
npm install @liveblocks/client @liveblocks/react @liveblocks/node react-resizable-panels
```

Expected: packages added to `node_modules` and `package.json`.

- [ ] **Step 2: Add `LIVEBLOCKS_SECRET_KEY` to `.env.local`**

```
LIVEBLOCKS_SECRET_KEY=sk_dev_your_key_here
```

Get the key from the Liveblocks dashboard → Settings → API Keys.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install liveblocks and react-resizable-panels"
```

---

## Task 2: Database migration

**Files:**
- Create: `supabase/migrations/20260509400000_plan_5_meetings.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260509400000_plan_5_meetings.sql

create table public.meetings (
  id            uuid primary key default gen_random_uuid(),
  show_id       uuid not null references public.shows(id) on delete cascade,
  title         text not null,
  scheduled_at  timestamptz not null,
  started_at    timestamptz,
  ended_at      timestamptz,
  created_by    uuid not null references public.profiles(id) on delete restrict,
  created_at    timestamptz not null default now()
);

create index meetings_show_id_idx    on public.meetings(show_id);
create index meetings_created_by_idx on public.meetings(created_by);

alter table public.meetings enable row level security;

create policy "org members can select meetings"
  on public.meetings for select
  using (
    exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = meetings.show_id and om.user_id = auth.uid()
    )
  );

create policy "org members can insert meetings"
  on public.meetings for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = meetings.show_id and om.user_id = auth.uid()
    )
  );

create policy "org members can update meetings"
  on public.meetings for update
  using (
    exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = meetings.show_id and om.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = meetings.show_id and om.user_id = auth.uid()
    )
  );

-- Add FK from notes.meeting_id now that meetings table exists
alter table public.notes
  add constraint notes_meeting_id_fkey
  foreign key (meeting_id) references public.meetings(id) on delete cascade;

-- Update notes RLS to cover meeting-attached notes (drop + recreate all three)
drop policy "org members can select notes" on public.notes;
drop policy "org members can insert notes" on public.notes;
drop policy "org members can update notes" on public.notes;

create policy "org members can select notes"
  on public.notes for select
  using (
    (material_id is not null and exists (
      select 1 from public.materials mat
      join public.departments d on d.id = mat.department_id
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where mat.id = notes.material_id and om.user_id = auth.uid()
    ))
    or (show_id is not null and exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = notes.show_id and om.user_id = auth.uid()
    ))
    or (meeting_id is not null and exists (
      select 1 from public.meetings m
      join public.shows s on s.id = m.show_id
      join public.org_members om on om.org_id = s.org_id
      where m.id = notes.meeting_id and om.user_id = auth.uid()
    ))
  );

create policy "org members can insert notes"
  on public.notes for insert
  with check (
    created_by = auth.uid()
    and (
      (material_id is not null and exists (
        select 1 from public.materials mat
        join public.departments d on d.id = mat.department_id
        join public.shows s on s.id = d.show_id
        join public.org_members om on om.org_id = s.org_id
        where mat.id = notes.material_id and om.user_id = auth.uid()
      ))
      or (show_id is not null and exists (
        select 1 from public.shows s
        join public.org_members om on om.org_id = s.org_id
        where s.id = notes.show_id and om.user_id = auth.uid()
      ))
      or (meeting_id is not null and exists (
        select 1 from public.meetings m
        join public.shows s on s.id = m.show_id
        join public.org_members om on om.org_id = s.org_id
        where m.id = notes.meeting_id and om.user_id = auth.uid()
      ))
    )
  );

create policy "org members can update notes"
  on public.notes for update
  using (
    (material_id is not null and exists (
      select 1 from public.materials mat
      join public.departments d on d.id = mat.department_id
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where mat.id = notes.material_id and om.user_id = auth.uid()
    ))
    or (show_id is not null and exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = notes.show_id and om.user_id = auth.uid()
    ))
    or (meeting_id is not null and exists (
      select 1 from public.meetings m
      join public.shows s on s.id = m.show_id
      join public.org_members om on om.org_id = s.org_id
      where m.id = notes.meeting_id and om.user_id = auth.uid()
    ))
  )
  with check (
    (material_id is not null and exists (
      select 1 from public.materials mat
      join public.departments d on d.id = mat.department_id
      join public.shows s on s.id = d.show_id
      join public.org_members om on om.org_id = s.org_id
      where mat.id = notes.material_id and om.user_id = auth.uid()
    ))
    or (show_id is not null and exists (
      select 1 from public.shows s
      join public.org_members om on om.org_id = s.org_id
      where s.id = notes.show_id and om.user_id = auth.uid()
    ))
    or (meeting_id is not null and exists (
      select 1 from public.meetings m
      join public.shows s on s.id = m.show_id
      join public.org_members om on om.org_id = s.org_id
      where m.id = notes.meeting_id and om.user_id = auth.uid()
    ))
  );
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration applied with no errors.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260509400000_plan_5_meetings.sql
git commit -m "feat: add meetings table and update notes RLS"
```

---

## Task 3: Domain types + Liveblocks config

**Files:**
- Modify: `lib/types/domain.ts`
- Modify: `lib/types/db.ts`
- Create: `lib/liveblocks.config.ts`
- Create: `app/api/liveblocks-auth/route.ts`

- [ ] **Step 1: Add `Meeting` and `MeetingNote` to `lib/types/domain.ts`**

Append to the end of the file:

```ts
export type Meeting = {
  id: string
  showId: string
  title: string
  scheduledAt: string
  startedAt: string | null
  endedAt: string | null
  createdBy: string
  createdAt: string
}

export type MeetingNote = Note
```

- [ ] **Step 2: Add `meetings` table to `lib/types/db.ts`**

Inside the `Tables` object (after the last table entry, before the closing `}`), append:

```ts
      meetings: {
        Row: {
          id: string
          show_id: string
          title: string
          scheduled_at: string
          started_at: string | null
          ended_at: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          show_id: string
          title: string
          scheduled_at: string
          started_at?: string | null
          ended_at?: string | null
          created_by: string
          created_at?: string
        }
        Update: {
          id?: string
          show_id?: string
          title?: string
          scheduled_at?: string
          started_at?: string | null
          ended_at?: string | null
          created_by?: string
          created_at?: string
        }
        Relationships: []
      }
```

- [ ] **Step 3: Create `lib/liveblocks.config.ts`**

```ts
import { createClient } from '@liveblocks/client'
import { createRoomContext } from '@liveblocks/react'
import type { MaterialState } from '@/lib/types/domain'

export type LBFilters = {
  department_ids: string[]
  tags: string[]
  states: MaterialState[]
}

export type LBStorage = {
  presenter_id: string | null
  presenter_request: { from_user_id: string; requested_at: number } | null
  active_meeting_id: string | null
  active_material_ids: string[]
  panel_sizes: number[]
  filters: LBFilters
}

export type LBPresence = {
  user_id: string
  current_material_id: string | null
  mode: 'browse' | 'follow'
  joined_at: number
}

export type LBUserMeta = {
  info: { name: string; initials: string }
}

export type LBRoomEvent = { type: 'navigate'; material_id: string }

export const EMPTY_FILTERS: LBFilters = {
  department_ids: [],
  tags: [],
  states: [],
}

export const INITIAL_STORAGE: LBStorage = {
  presenter_id: null,
  presenter_request: null,
  active_meeting_id: null,
  active_material_ids: [],
  panel_sizes: [],
  filters: EMPTY_FILTERS,
}

const client = createClient({ authEndpoint: '/api/liveblocks-auth' })

export const {
  RoomProvider,
  useStorage,
  useMutation,
  useOthers,
  useSelf,
  useBroadcastEvent,
  useEventListener,
  useUpdateMyPresence,
} = createRoomContext<LBPresence, LBStorage, LBUserMeta, LBRoomEvent>(client)
```

- [ ] **Step 4: Create `app/api/liveblocks-auth/route.ts`**

```ts
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
  session.allow(room, session.FULL_ACCESS)

  const { status, body } = await session.authorize()
  return new Response(body, { status })
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/types/domain.ts lib/types/db.ts lib/liveblocks.config.ts app/api/liveblocks-auth/route.ts
git commit -m "feat: add Meeting types and Liveblocks config"
```

---

## Task 4: Liveblocks pure helpers — layout and filters

**Files:**
- Create: `lib/liveblocks/layout.ts`
- Create: `lib/liveblocks/filters.ts`
- Create: `__tests__/lib/liveblocks/layout.test.ts`
- Create: `__tests__/lib/liveblocks/filters.test.ts`

- [ ] **Step 1: Write failing tests for `layout.ts`**

```ts
// __tests__/lib/liveblocks/layout.test.ts
import { describe, it, expect } from 'vitest'
import { defaultPanelSizes } from '@/lib/liveblocks/layout'

describe('defaultPanelSizes', () => {
  it('returns [100] for 1 panel', () => {
    expect(defaultPanelSizes(1)).toEqual([100])
  })

  it('returns [50, 50] for 2 panels', () => {
    expect(defaultPanelSizes(2)).toEqual([50, 50])
  })

  it('returns [33, 33, 34] for 3 panels', () => {
    expect(defaultPanelSizes(3)).toEqual([33, 33, 34])
  })

  it('returns [25, 25, 25, 25] for 4 panels', () => {
    expect(defaultPanelSizes(4)).toEqual([25, 25, 25, 25])
  })

  it('throws for n < 1', () => {
    expect(() => defaultPanelSizes(0)).toThrow()
  })

  it('throws for n > 4', () => {
    expect(() => defaultPanelSizes(5)).toThrow()
  })

  it('sizes sum to 100', () => {
    for (const n of [1, 2, 3, 4]) {
      const sum = defaultPanelSizes(n).reduce((a, b) => a + b, 0)
      expect(sum).toBe(100)
    }
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/lib/liveblocks/layout.test.ts
```

Expected: FAIL — `defaultPanelSizes` not found.

- [ ] **Step 3: Implement `lib/liveblocks/layout.ts`**

```ts
export function defaultPanelSizes(n: number): number[] {
  if (n < 1 || n > 4) throw new Error(`Panel count must be 1–4, got ${n}`)
  if (n === 1) return [100]
  if (n === 2) return [50, 50]
  if (n === 3) return [33, 33, 34]
  return [25, 25, 25, 25]
}
```

- [ ] **Step 4: Run layout tests — expect PASS**

```bash
npx vitest run __tests__/lib/liveblocks/layout.test.ts
```

- [ ] **Step 5: Write failing tests for `filters.ts`**

```ts
// __tests__/lib/liveblocks/filters.test.ts
import { describe, it, expect } from 'vitest'
import { filterMaterials } from '@/lib/liveblocks/filters'
import type { Material } from '@/lib/types/domain'

const mat = (overrides: Partial<Material> = {}): Material => ({
  id: 'mat-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Test',
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('filterMaterials', () => {
  it('returns all materials when all filters are empty', () => {
    const mats = [mat({ id: 'a' }), mat({ id: 'b' })]
    expect(filterMaterials(mats, { department_ids: [], tags: [], states: [] })).toHaveLength(2)
  })

  it('filters by department_ids', () => {
    const mats = [mat({ id: 'a', departmentId: 'dept-1' }), mat({ id: 'b', departmentId: 'dept-2' })]
    const result = filterMaterials(mats, { department_ids: ['dept-1'], tags: [], states: [] })
    expect(result.map(m => m.id)).toEqual(['a'])
  })

  it('filters by states', () => {
    const mats = [mat({ id: 'a', state: 'exploratory' }), mat({ id: 'b', state: 'proposed' })]
    const result = filterMaterials(mats, { department_ids: [], tags: [], states: ['proposed'] })
    expect(result.map(m => m.id)).toEqual(['b'])
  })

  it('filters by tags — material must have at least one matching tag', () => {
    const mats = [
      mat({ id: 'a', tags: ['act-1', 'dark'] }),
      mat({ id: 'b', tags: ['act-2'] }),
    ]
    const result = filterMaterials(mats, { department_ids: [], tags: ['act-1'], states: [] })
    expect(result.map(m => m.id)).toEqual(['a'])
  })

  it('applies all filters together (AND)', () => {
    const mats = [
      mat({ id: 'a', departmentId: 'dept-1', state: 'proposed', tags: ['act-1'] }),
      mat({ id: 'b', departmentId: 'dept-1', state: 'exploratory', tags: ['act-1'] }),
      mat({ id: 'c', departmentId: 'dept-2', state: 'proposed', tags: ['act-1'] }),
    ]
    const result = filterMaterials(mats, {
      department_ids: ['dept-1'],
      tags: ['act-1'],
      states: ['proposed'],
    })
    expect(result.map(m => m.id)).toEqual(['a'])
  })
})
```

- [ ] **Step 6: Run to verify failure**

```bash
npx vitest run __tests__/lib/liveblocks/filters.test.ts
```

Expected: FAIL.

- [ ] **Step 7: Implement `lib/liveblocks/filters.ts`**

```ts
import type { Material } from '@/lib/types/domain'
import type { LBFilters } from '@/lib/liveblocks.config'

export function filterMaterials(materials: Material[], filters: LBFilters): Material[] {
  return materials.filter((m) => {
    if (filters.department_ids.length > 0 && !filters.department_ids.includes(m.departmentId)) return false
    if (filters.states.length > 0 && !filters.states.includes(m.state)) return false
    if (filters.tags.length > 0 && !filters.tags.some((t) => m.tags.includes(t))) return false
    return true
  })
}
```

- [ ] **Step 8: Run all liveblocks helper tests — expect PASS**

```bash
npx vitest run __tests__/lib/liveblocks/
```

- [ ] **Step 9: Commit**

```bash
git add lib/liveblocks/ __tests__/lib/liveblocks/layout.test.ts __tests__/lib/liveblocks/filters.test.ts
git commit -m "feat: add layout and filter helpers with tests"
```

---

## Task 5: Liveblocks storage mutations

**Files:**
- Create: `lib/liveblocks/mutations.ts`
- Create: `__tests__/lib/liveblocks/mutations.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/liveblocks/mutations.test.ts
import { describe, it, expect } from 'vitest'
import {
  claimPresenter, requestPresenter, yieldPresenter,
  clearPresenterRequest, releasePresenter,
  setActiveMaterials, setPanelSizes, setFilters,
} from '@/lib/liveblocks/mutations'
import type { LBStorage } from '@/lib/liveblocks.config'

function makeStorage(init: Partial<LBStorage> = {}) {
  const state: LBStorage = {
    presenter_id: null,
    presenter_request: null,
    active_meeting_id: null,
    active_material_ids: [],
    panel_sizes: [],
    filters: { department_ids: [], tags: [], states: [] },
    ...init,
  }
  return {
    get: <K extends keyof LBStorage>(k: K) => state[k],
    set: <K extends keyof LBStorage>(k: K, v: LBStorage[K]) => { state[k] = v as LBStorage[K] },
    _state: state,
  }
}

describe('claimPresenter', () => {
  it('sets presenter_id and clears any pending request', () => {
    const s = makeStorage({ presenter_request: { from_user_id: 'u2', requested_at: 1 } })
    claimPresenter(s, 'u1')
    expect(s._state.presenter_id).toBe('u1')
    expect(s._state.presenter_request).toBeNull()
  })
})

describe('requestPresenter', () => {
  it('writes presenter_request with user and timestamp', () => {
    const s = makeStorage()
    const before = Date.now()
    requestPresenter(s, 'u2')
    expect(s._state.presenter_request?.from_user_id).toBe('u2')
    expect(s._state.presenter_request?.requested_at).toBeGreaterThanOrEqual(before)
  })
})

describe('yieldPresenter', () => {
  it('sets presenter_id to requester and clears request', () => {
    const s = makeStorage({
      presenter_id: 'u1',
      presenter_request: { from_user_id: 'u2', requested_at: 1 },
    })
    yieldPresenter(s)
    expect(s._state.presenter_id).toBe('u2')
    expect(s._state.presenter_request).toBeNull()
  })

  it('is a no-op when no request is pending', () => {
    const s = makeStorage({ presenter_id: 'u1' })
    yieldPresenter(s)
    expect(s._state.presenter_id).toBe('u1')
  })
})

describe('clearPresenterRequest', () => {
  it('clears presenter_request without touching presenter_id', () => {
    const s = makeStorage({
      presenter_id: 'u1',
      presenter_request: { from_user_id: 'u2', requested_at: 1 },
    })
    clearPresenterRequest(s)
    expect(s._state.presenter_request).toBeNull()
    expect(s._state.presenter_id).toBe('u1')
  })
})

describe('releasePresenter', () => {
  it('clears presenter_id', () => {
    const s = makeStorage({ presenter_id: 'u1' })
    releasePresenter(s)
    expect(s._state.presenter_id).toBeNull()
  })
})

describe('setActiveMaterials', () => {
  it('caps at 4 materials', () => {
    const s = makeStorage()
    setActiveMaterials(s, ['a', 'b', 'c', 'd', 'e'])
    expect(s._state.active_material_ids).toHaveLength(4)
  })

  it('sets default panel sizes when none provided', () => {
    const s = makeStorage()
    setActiveMaterials(s, ['a', 'b'])
    expect(s._state.panel_sizes).toEqual([50, 50])
  })

  it('uses provided panel sizes', () => {
    const s = makeStorage()
    setActiveMaterials(s, ['a', 'b'], [60, 40])
    expect(s._state.panel_sizes).toEqual([60, 40])
  })
})

describe('setPanelSizes', () => {
  it('updates panel_sizes', () => {
    const s = makeStorage({ panel_sizes: [50, 50] })
    setPanelSizes(s, [70, 30])
    expect(s._state.panel_sizes).toEqual([70, 30])
  })
})

describe('setFilters', () => {
  it('updates filters', () => {
    const s = makeStorage()
    setFilters(s, { department_ids: ['d1'], tags: ['act-1'], states: ['proposed'] })
    expect(s._state.filters.department_ids).toEqual(['d1'])
    expect(s._state.filters.tags).toEqual(['act-1'])
    expect(s._state.filters.states).toEqual(['proposed'])
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/lib/liveblocks/mutations.test.ts
```

- [ ] **Step 3: Implement `lib/liveblocks/mutations.ts`**

```ts
import { defaultPanelSizes } from '@/lib/liveblocks/layout'
import type { LBStorage, LBFilters } from '@/lib/liveblocks.config'

export type StorageLike = {
  get<K extends keyof LBStorage>(key: K): LBStorage[K]
  set<K extends keyof LBStorage>(key: K, value: LBStorage[K]): void
}

export function claimPresenter(storage: StorageLike, userId: string) {
  storage.set('presenter_id', userId)
  storage.set('presenter_request', null)
}

export function requestPresenter(storage: StorageLike, userId: string) {
  storage.set('presenter_request', { from_user_id: userId, requested_at: Date.now() })
}

export function yieldPresenter(storage: StorageLike) {
  const req = storage.get('presenter_request')
  if (!req) return
  storage.set('presenter_id', req.from_user_id)
  storage.set('presenter_request', null)
}

export function clearPresenterRequest(storage: StorageLike) {
  storage.set('presenter_request', null)
}

export function releasePresenter(storage: StorageLike) {
  storage.set('presenter_id', null)
}

export function setActiveMaterials(
  storage: StorageLike,
  materialIds: string[],
  panelSizes?: number[]
) {
  const ids = materialIds.slice(0, 4)
  const sizes = panelSizes ?? defaultPanelSizes(Math.max(ids.length, 1))
  storage.set('active_material_ids', ids)
  storage.set('panel_sizes', sizes)
}

export function setPanelSizes(storage: StorageLike, sizes: number[]) {
  storage.set('panel_sizes', sizes)
}

export function setFilters(storage: StorageLike, filters: LBFilters) {
  storage.set('filters', filters)
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/lib/liveblocks/mutations.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/liveblocks/mutations.ts __tests__/lib/liveblocks/mutations.test.ts
git commit -m "feat: add Liveblocks storage mutation helpers with tests"
```

---

## Task 6: Data layer — meetings

**Files:**
- Create: `lib/data/meetings.ts`
- Modify: `lib/data/notes.ts`
- Create: `__tests__/lib/data/meetings.test.ts`

- [ ] **Step 1: Write failing tests for meetings data**

```ts
// __tests__/lib/data/meetings.test.ts
import { describe, it, expect, vi } from 'vitest'

const mockSingle = vi.fn()
const mockOrder = vi.fn(() => ({ single: mockSingle }))
const mockEq = vi.fn(() => ({ order: mockOrder, single: mockSingle }))
const mockSelect = vi.fn(() => ({ eq: mockEq }))

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    from: vi.fn(() => ({ select: mockSelect })),
  }),
}))

const MEETING_ROW = {
  id: 'meet-1',
  show_id: 'show-1',
  title: 'Weekly Design',
  scheduled_at: '2026-06-01T18:00:00Z',
  started_at: null,
  ended_at: null,
  created_by: 'user-1',
  created_at: '2026-05-09T00:00:00Z',
}

describe('getMeetingsByShow', () => {
  it('maps snake_case row to camelCase Meeting', async () => {
    vi.resetModules()
    mockOrder.mockResolvedValueOnce({ data: [MEETING_ROW], error: null })
    const { getMeetingsByShow } = await import('@/lib/data/meetings')
    const result = await getMeetingsByShow('show-1')
    expect(result[0]).toMatchObject({
      id: 'meet-1',
      showId: 'show-1',
      title: 'Weekly Design',
      scheduledAt: '2026-06-01T18:00:00Z',
      startedAt: null,
      endedAt: null,
      createdBy: 'user-1',
    })
  })

  it('returns [] on error', async () => {
    vi.resetModules()
    mockOrder.mockResolvedValueOnce({ data: null, error: new Error('db error') })
    const { getMeetingsByShow } = await import('@/lib/data/meetings')
    expect(await getMeetingsByShow('show-1')).toEqual([])
  })
})

describe('getMeetingById', () => {
  it('returns null on error', async () => {
    vi.resetModules()
    mockSingle.mockResolvedValueOnce({ data: null, error: new Error('not found') })
    const { getMeetingById } = await import('@/lib/data/meetings')
    expect(await getMeetingById('bad-id')).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/lib/data/meetings.test.ts
```

- [ ] **Step 3: Implement `lib/data/meetings.ts`**

```ts
import { cache } from 'react'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { Meeting } from '@/lib/types/domain'

const MEETING_SELECT =
  'id, show_id, title, scheduled_at, started_at, ended_at, created_by, created_at'

function mapRow(row: {
  id: string; show_id: string; title: string
  scheduled_at: string; started_at: string | null; ended_at: string | null
  created_by: string; created_at: string
}): Meeting {
  return {
    id: row.id,
    showId: row.show_id,
    title: row.title,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
  }
}

export const getMeetingsByShow = cache(async (showId: string): Promise<Meeting[]> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .eq('show_id', showId)
    .order('scheduled_at', { ascending: true })
  if (error || !data) return []
  return data.map(mapRow)
})

export const getMeetingById = cache(async (meetingId: string): Promise<Meeting | null> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('meetings')
    .select(MEETING_SELECT)
    .eq('id', meetingId)
    .single()
  if (error || !data) return null
  return mapRow(data)
})
```

- [ ] **Step 4: Add `getNotesByMeeting` to `lib/data/notes.ts`**

Append after `getNotesByShow`:

```ts
export const getNotesByMeeting = cache(
  async (meetingId: string): Promise<NoteWithAuthors[]> => {
    const supabase = await createSupabaseServerClient()
    const { data: rows, error } = await supabase
      .from('notes')
      .select(NOTE_SELECT)
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: true })
    if (error || !rows || rows.length === 0) return []
    const nameMap = await hydrateAuthors(supabase, rows)
    return rows.map((r) => mapRow(r, nameMap))
  }
)
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx vitest run __tests__/lib/data/meetings.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add lib/data/meetings.ts lib/data/notes.ts __tests__/lib/data/meetings.test.ts
git commit -m "feat: add meetings data layer and getNotesByMeeting"
```

---

## Task 7: Server Actions — meetings

**Files:**
- Create: `lib/actions/meetings.ts`
- Create: `__tests__/lib/actions/meetings.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/actions/meetings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ single: mockSingle }))
const mockIs = vi.fn().mockResolvedValue({ error: null })
const mockEq = vi.fn(() => ({ single: mockSingle, is: mockIs }))
const mockUpdate = vi.fn(() => ({ eq: mockEq }))
const mockInsertSelect = vi.fn(() => ({ single: mockSingle }))
const mockInsert = vi.fn(() => ({ select: mockInsertSelect }))

const mockFromImpl = vi.fn((table: string) => {
  if (table === 'meetings') return { insert: mockInsert, update: mockUpdate, select: mockSelect }
  if (table === 'show_members') return { select: mockSelect }
  if (table === 'notes') return { insert: mockInsert, update: mockUpdate }
  return {}
})

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000'
const TEST_MEETING_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const TEST_SHOW_ID = 'b1ccdc00-1d2c-5fg9-cc7e-7cc0ce491b22'

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    from: mockFromImpl,
    auth: { getUser: mockGetUser },
  }),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

describe('createMeeting', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
    // show_members returns can_manage_show permission
    mockSingle
      .mockResolvedValueOnce({ data: { role_definitions: { permissions: ['can_manage_show'] } }, error: null })
      .mockResolvedValueOnce({ data: { id: TEST_MEETING_ID }, error: null })
  })

  it('inserts meeting and returns id', async () => {
    const { createMeeting } = await import('@/lib/actions/meetings')
    const result = await createMeeting(TEST_SHOW_ID, 'Weekly Design', '2026-06-01T18:00:00.000Z')
    expect(result).toEqual({ id: TEST_MEETING_ID })
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      show_id: TEST_SHOW_ID,
      title: 'Weekly Design',
      created_by: TEST_USER_ID,
    }))
  })

  it('throws Forbidden when user lacks can_manage_show', async () => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
    mockSingle.mockResolvedValueOnce({ data: { role_definitions: { permissions: [] } }, error: null })
    const { createMeeting } = await import('@/lib/actions/meetings')
    await expect(createMeeting(TEST_SHOW_ID, 'Title', '2026-06-01T18:00:00.000Z')).rejects.toThrow('Forbidden')
  })

  it('throws Unauthorized when not logged in', async () => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: null } })
    const { createMeeting } = await import('@/lib/actions/meetings')
    await expect(createMeeting(TEST_SHOW_ID, 'Title', '2026-06-01T18:00:00.000Z')).rejects.toThrow('Unauthorized')
  })
})

describe('startMeeting', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
    mockIs.mockResolvedValue({ error: null })
  })

  it('updates started_at only when currently null', async () => {
    const { startMeeting } = await import('@/lib/actions/meetings')
    await startMeeting(TEST_MEETING_ID)
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ started_at: expect.any(String) }))
    expect(mockIs).toHaveBeenCalledWith('started_at', null)
  })
})

describe('addMeetingNote', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: TEST_USER_ID } } })
    mockSingle.mockResolvedValue({ data: { id: 'note-1' }, error: null })
  })

  it('inserts note with meeting_id', async () => {
    const { addMeetingNote } = await import('@/lib/actions/meetings')
    const result = await addMeetingNote(TEST_MEETING_ID, 'Agreed on dark palette.')
    expect(result).toEqual({ id: 'note-1' })
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      meeting_id: TEST_MEETING_ID,
      body: 'Agreed on dark palette.',
      created_by: TEST_USER_ID,
    }))
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/lib/actions/meetings.test.ts
```

- [ ] **Step 3: Implement `lib/actions/meetings.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const uuidSchema = z.string().uuid()
const titleSchema = z.string().min(1).max(200)
const scheduledAtSchema = z.string().datetime()

async function assertCanManageShow(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  showId: string,
  userId: string
) {
  const { data } = await supabase
    .from('show_members')
    .select('role_definitions ( permissions )')
    .eq('show_id', showId)
    .eq('user_id', userId)
    .single()
  const permissions = (data?.role_definitions as { permissions: string[] } | null)?.permissions ?? []
  if (!permissions.includes('can_manage_show')) throw new Error('Forbidden')
}

export async function createMeeting(
  showId: string,
  title: string,
  scheduledAt: string
): Promise<{ id: string }> {
  uuidSchema.parse(showId)
  titleSchema.parse(title)
  scheduledAtSchema.parse(scheduledAt)

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  await assertCanManageShow(supabase, showId, user.id)

  const { data: row, error } = await supabase
    .from('meetings')
    .insert({ show_id: showId, title, scheduled_at: scheduledAt, created_by: user.id })
    .select('id')
    .single()
  if (error || !row) throw new Error('Operation failed')

  revalidatePath('', 'layout')
  return { id: row.id }
}

export async function startMeeting(meetingId: string): Promise<void> {
  uuidSchema.parse(meetingId)

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('meetings')
    .update({ started_at: new Date().toISOString() })
    .eq('id', meetingId)
    .is('started_at', null)
  if (error) throw new Error('Operation failed')

  revalidatePath('', 'layout')
}

export async function endMeeting(meetingId: string): Promise<void> {
  uuidSchema.parse(meetingId)

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: meeting } = await supabase
    .from('meetings')
    .select('show_id')
    .eq('id', meetingId)
    .single()
  if (!meeting) throw new Error('Not found')

  await assertCanManageShow(supabase, meeting.show_id, user.id)

  const { error } = await supabase
    .from('meetings')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', meetingId)
  if (error) throw new Error('Operation failed')

  revalidatePath('', 'layout')
}

export async function addMeetingNote(
  meetingId: string,
  body: string
): Promise<{ id: string }> {
  uuidSchema.parse(meetingId)
  z.string().min(1).max(10000).parse(body)

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: row, error } = await supabase
    .from('notes')
    .insert({ body, tags: [], created_by: user.id, updated_by: user.id, meeting_id: meetingId })
    .select('id')
    .single()
  if (error || !row) throw new Error('Operation failed')

  revalidatePath('', 'layout')
  return { id: row.id }
}

export async function hideMeetingNote(noteId: string): Promise<void> {
  uuidSchema.parse(noteId)

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('notes')
    .update({ hidden_at: new Date().toISOString() })
    .eq('id', noteId)
  if (error) throw new Error('Operation failed')
  revalidatePath('', 'layout')
}

export async function restoreMeetingNote(noteId: string): Promise<void> {
  uuidSchema.parse(noteId)

  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('notes')
    .update({ hidden_at: null })
    .eq('id', noteId)
  if (error) throw new Error('Operation failed')
  revalidatePath('', 'layout')
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/lib/actions/meetings.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/actions/meetings.ts __tests__/lib/actions/meetings.test.ts
git commit -m "feat: add meeting server actions with tests"
```

---

## Task 8: JoinPrompt component

**Files:**
- Create: `components/meetings/JoinPrompt.tsx`
- Create: `__tests__/components/meetings/JoinPrompt.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/meetings/JoinPrompt.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

describe('JoinPrompt', () => {
  it('renders both join options', async () => {
    const { JoinPrompt } = await import('@/components/meetings/JoinPrompt')
    render(<JoinPrompt onJoin={vi.fn()} />)
    expect(screen.getByText(/Join as viewer/i)).toBeInTheDocument()
    expect(screen.getByText(/Browse freely/i)).toBeInTheDocument()
  })

  it('calls onJoin with "follow" when viewer button clicked', async () => {
    const { JoinPrompt } = await import('@/components/meetings/JoinPrompt')
    const onJoin = vi.fn()
    render(<JoinPrompt onJoin={onJoin} />)
    fireEvent.click(screen.getByText(/Join as viewer/i))
    expect(onJoin).toHaveBeenCalledWith('follow')
  })

  it('calls onJoin with "browse" when browse button clicked', async () => {
    const { JoinPrompt } = await import('@/components/meetings/JoinPrompt')
    const onJoin = vi.fn()
    render(<JoinPrompt onJoin={onJoin} />)
    fireEvent.click(screen.getByText(/Browse freely/i))
    expect(onJoin).toHaveBeenCalledWith('browse')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/components/meetings/JoinPrompt.test.tsx
```

- [ ] **Step 3: Implement `components/meetings/JoinPrompt.tsx`**

```tsx
'use client'

type Mode = 'browse' | 'follow'

type Props = {
  onJoin: (mode: Mode) => void
}

export function JoinPrompt({ onJoin }: Props) {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-8 max-w-sm w-full text-center space-y-6">
        <h2 className="text-white text-lg font-semibold">Join the meeting</h2>
        <div className="space-y-3">
          <button
            onClick={() => onJoin('follow')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded px-4 py-3 text-sm font-medium"
          >
            Join as viewer — follow presenter
          </button>
          <button
            onClick={() => onJoin('browse')}
            className="w-full bg-neutral-700 hover:bg-neutral-600 text-white rounded px-4 py-3 text-sm font-medium"
          >
            Browse freely
          </button>
        </div>
        <p className="text-neutral-500 text-xs">
          You can switch modes at any time during the meeting.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/components/meetings/JoinPrompt.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/meetings/JoinPrompt.tsx __tests__/components/meetings/JoinPrompt.test.tsx
git commit -m "feat: add JoinPrompt component with tests"
```

---

## Task 9: MaterialPanel + LightTable

**Files:**
- Create: `components/meetings/MaterialPanel.tsx`
- Create: `components/meetings/LightTable.tsx`

No unit tests for these — they render Supabase-fetched materials and `react-resizable-panels` internals; covered by manual QA.

- [ ] **Step 1: Implement `components/meetings/MaterialPanel.tsx`**

```tsx
'use client'

import ReactMarkdown from 'react-markdown'
import type { Material } from '@/lib/types/domain'

type Props = { material: Material }

export function MaterialPanel({ material }: Props) {
  return (
    <div className="h-full flex flex-col bg-neutral-900 border border-neutral-700 rounded overflow-hidden">
      <div className="px-3 py-2 border-b border-neutral-700 flex items-center gap-2">
        <span className="text-white text-sm font-medium truncate">{material.title}</span>
        <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
          material.state === 'decided'
            ? 'bg-green-900 text-green-300'
            : material.state === 'proposed'
            ? 'bg-blue-900 text-blue-300'
            : 'bg-neutral-700 text-neutral-400'
        }`}>
          {material.state}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {material.type === 'image' && material.url && (
          <img src={material.url} alt={material.title} className="max-w-full max-h-full object-contain mx-auto" />
        )}
        {material.type === 'link' && material.url && (
          <a href={material.url} target="_blank" rel="noopener noreferrer"
            className="text-blue-400 underline break-all">
            {material.url}
          </a>
        )}
        {material.type === 'note' && material.body && (
          <div className="prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>{material.body}</ReactMarkdown>
          </div>
        )}
        {material.type === 'file' && (
          <div className="text-neutral-400 text-sm">
            File: {material.storagePath ?? material.title}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement `components/meetings/LightTable.tsx`**

```tsx
'use client'

import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels'
import { MaterialPanel } from '@/components/meetings/MaterialPanel'
import type { Material } from '@/lib/types/domain'

type Props = {
  materials: Material[]
  panelSizes: number[]
  onPanelResize: (sizes: number[]) => void
}

export function LightTable({ materials, panelSizes, onPanelResize }: Props) {
  if (materials.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-neutral-600 text-sm">
        Click a thumbnail to add materials to the light table.
      </div>
    )
  }

  const defaultSizes = panelSizes.length === materials.length ? panelSizes : undefined

  return (
    <PanelGroup
      direction="horizontal"
      onLayout={onPanelResize}
      className="h-full"
    >
      {materials.map((mat, i) => (
        <>
          <Panel key={mat.id} defaultSize={defaultSizes?.[i]}>
            <MaterialPanel material={mat} />
          </Panel>
          {i < materials.length - 1 && (
            <PanelResizeHandle
              key={`handle-${i}`}
              className="w-1 bg-neutral-800 hover:bg-blue-600 transition-colors cursor-col-resize"
            />
          )}
        </>
      ))}
    </PanelGroup>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/meetings/MaterialPanel.tsx components/meetings/LightTable.tsx
git commit -m "feat: add MaterialPanel and LightTable components"
```

---

## Task 10: Filmstrip component

**Files:**
- Create: `components/meetings/Filmstrip.tsx`
- Create: `__tests__/components/meetings/Filmstrip.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/meetings/Filmstrip.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Material } from '@/lib/types/domain'

const mat = (id: string): Material => ({
  id,
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: `Material ${id}`,
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-01-01T00:00:00Z',
})

describe('Filmstrip', () => {
  it('renders thumbnails for each material', async () => {
    const { Filmstrip } = await import('@/components/meetings/Filmstrip')
    render(
      <Filmstrip
        materials={[mat('a'), mat('b')]}
        activeMaterialIds={[]}
        onToggle={vi.fn()}
        onFilterChange={vi.fn()}
        filters={{ department_ids: [], tags: [], states: [] }}
        departments={[]}
      />
    )
    expect(screen.getByText('Material a')).toBeInTheDocument()
    expect(screen.getByText('Material b')).toBeInTheDocument()
  })

  it('calls onToggle with material id when thumbnail clicked', async () => {
    const { Filmstrip } = await import('@/components/meetings/Filmstrip')
    const onToggle = vi.fn()
    render(
      <Filmstrip
        materials={[mat('a')]}
        activeMaterialIds={[]}
        onToggle={onToggle}
        onFilterChange={vi.fn()}
        filters={{ department_ids: [], tags: [], states: [] }}
        departments={[]}
      />
    )
    fireEvent.click(screen.getByText('Material a'))
    expect(onToggle).toHaveBeenCalledWith('a')
  })

  it('highlights active materials', async () => {
    const { Filmstrip } = await import('@/components/meetings/Filmstrip')
    const { container } = render(
      <Filmstrip
        materials={[mat('a'), mat('b')]}
        activeMaterialIds={['a']}
        onToggle={vi.fn()}
        onFilterChange={vi.fn()}
        filters={{ department_ids: [], tags: [], states: [] }}
        departments={[]}
      />
    )
    const items = container.querySelectorAll('[data-active]')
    expect(items).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/components/meetings/Filmstrip.test.tsx
```

- [ ] **Step 3: Implement `components/meetings/Filmstrip.tsx`**

```tsx
'use client'

import type { Material, MaterialState } from '@/lib/types/domain'
import type { LBFilters } from '@/lib/liveblocks.config'

type Props = {
  materials: Material[]
  activeMaterialIds: string[]
  onToggle: (materialId: string) => void
  filters: LBFilters
  onFilterChange: (filters: LBFilters) => void
  departments: { id: string; name: string }[]
}

const ALL_STATES: MaterialState[] = ['exploratory', 'proposed', 'decided']

export function Filmstrip({
  materials, activeMaterialIds, onToggle,
  filters, onFilterChange, departments,
}: Props) {
  const tags = [...new Set(materials.flatMap((m) => m.tags))].sort()

  function toggleState(state: MaterialState) {
    const next = filters.states.includes(state)
      ? filters.states.filter((s) => s !== state)
      : [...filters.states, state]
    onFilterChange({ ...filters, states: next })
  }

  function toggleTag(tag: string) {
    const next = filters.tags.includes(tag)
      ? filters.tags.filter((t) => t !== tag)
      : [...filters.tags, tag]
    onFilterChange({ ...filters, tags: next })
  }

  function toggleDept(id: string) {
    const next = filters.department_ids.includes(id)
      ? filters.department_ids.filter((d) => d !== id)
      : [...filters.department_ids, id]
    onFilterChange({ ...filters, department_ids: next })
  }

  return (
    <div className="flex items-center gap-3 h-full">
      {/* Filter controls */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {departments.map((d) => (
          <button
            key={d.id}
            onClick={() => toggleDept(d.id)}
            className={`text-xs px-2 py-1 rounded ${
              filters.department_ids.includes(d.id)
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
            }`}
          >
            {d.name}
          </button>
        ))}
        {ALL_STATES.map((s) => (
          <button
            key={s}
            onClick={() => toggleState(s)}
            className={`text-xs px-2 py-1 rounded ${
              filters.states.includes(s)
                ? 'bg-blue-600 text-white'
                : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
            }`}
          >
            {s}
          </button>
        ))}
        {tags.map((t) => (
          <button
            key={t}
            onClick={() => toggleTag(t)}
            className={`text-xs px-2 py-1 rounded ${
              filters.tags.includes(t)
                ? 'bg-purple-600 text-white'
                : 'bg-neutral-700 text-neutral-400 hover:bg-neutral-600'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-8 bg-neutral-700 flex-shrink-0" />

      {/* Thumbnails */}
      <div className="flex gap-2 overflow-x-auto flex-1 py-1">
        {materials.map((m) => {
          const isActive = activeMaterialIds.includes(m.id)
          return (
            <button
              key={m.id}
              data-active={isActive ? '' : undefined}
              onClick={() => onToggle(m.id)}
              title={m.title}
              className={`flex-shrink-0 w-14 h-10 rounded border text-xs flex items-end p-0.5 overflow-hidden ${
                isActive
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-neutral-600 bg-neutral-800 hover:border-neutral-400'
              }`}
            >
              <span className="truncate text-neutral-300 text-[9px] w-full text-center">
                {m.title}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/components/meetings/Filmstrip.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/meetings/Filmstrip.tsx __tests__/components/meetings/Filmstrip.test.tsx
git commit -m "feat: add Filmstrip component with filter controls and tests"
```

---

## Task 11: PresenceBar + presenter controls

**Files:**
- Create: `components/meetings/PresenceBar.tsx`
- Create: `components/meetings/PresenterControls.tsx`
- Create: `components/meetings/FollowBanner.tsx`
- Create: `components/meetings/PresenterRequestToast.tsx`
- Create: `__tests__/components/meetings/PresenterControls.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/meetings/PresenterControls.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

describe('PresenterControls', () => {
  it('shows "Claim presenter" when no presenter', async () => {
    const { PresenterControls } = await import('@/components/meetings/PresenterControls')
    render(
      <PresenterControls
        presenterId={null}
        presenterRequest={null}
        selfUserId="u1"
        onClaim={vi.fn()}
        onRequest={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText(/Claim presenter/i)).toBeInTheDocument()
  })

  it('shows "Release" when self is presenter', async () => {
    const { PresenterControls } = await import('@/components/meetings/PresenterControls')
    render(
      <PresenterControls
        presenterId="u1"
        presenterRequest={null}
        selfUserId="u1"
        onClaim={vi.fn()}
        onRequest={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText(/Release/i)).toBeInTheDocument()
  })

  it('shows "Request presenter" when someone else is presenter', async () => {
    const { PresenterControls } = await import('@/components/meetings/PresenterControls')
    render(
      <PresenterControls
        presenterId="u2"
        presenterRequest={null}
        selfUserId="u1"
        onClaim={vi.fn()}
        onRequest={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText(/Request presenter/i)).toBeInTheDocument()
  })

  it('disables "Request presenter" when a request is already pending', async () => {
    const { PresenterControls } = await import('@/components/meetings/PresenterControls')
    render(
      <PresenterControls
        presenterId="u2"
        presenterRequest={{ from_user_id: 'u3', requested_at: 1 }}
        selfUserId="u1"
        onClaim={vi.fn()}
        onRequest={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    expect(screen.getByText(/Request presenter/i).closest('button')).toBeDisabled()
  })

  it('calls onClaim when claim button clicked', async () => {
    const { PresenterControls } = await import('@/components/meetings/PresenterControls')
    const onClaim = vi.fn()
    render(
      <PresenterControls
        presenterId={null}
        presenterRequest={null}
        selfUserId="u1"
        onClaim={onClaim}
        onRequest={vi.fn()}
        onRelease={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Claim presenter/i))
    expect(onClaim).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/components/meetings/PresenterControls.test.tsx
```

- [ ] **Step 3: Implement `components/meetings/PresenceBar.tsx`**

```tsx
'use client'

type Member = {
  userId: string
  name: string
  initials: string
  isPresenter: boolean
  mode: 'browse' | 'follow'
}

type Props = { members: Member[] }

export function PresenceBar({ members }: Props) {
  return (
    <div className="flex items-center gap-1">
      {members.map((m) => (
        <div
          key={m.userId}
          title={`${m.name} (${m.isPresenter ? 'presenting' : m.mode})`}
          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white border-2 ${
            m.isPresenter ? 'border-green-500 bg-green-800' : 'border-blue-500 bg-blue-900'
          }`}
        >
          {m.initials}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Implement `components/meetings/PresenterControls.tsx`**

```tsx
'use client'

type Props = {
  presenterId: string | null
  presenterRequest: { from_user_id: string; requested_at: number } | null
  selfUserId: string
  onClaim: () => void
  onRequest: () => void
  onRelease: () => void
}

export function PresenterControls({
  presenterId, presenterRequest, selfUserId,
  onClaim, onRequest, onRelease,
}: Props) {
  const isSelfPresenter = presenterId === selfUserId
  const hasPresenter = presenterId !== null
  const requestPending = presenterRequest !== null

  if (!hasPresenter) {
    return (
      <button
        onClick={onClaim}
        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded"
      >
        Claim presenter
      </button>
    )
  }

  if (isSelfPresenter) {
    return (
      <button
        onClick={onRelease}
        className="text-xs bg-neutral-700 hover:bg-neutral-600 text-white px-3 py-1.5 rounded"
      >
        Release
      </button>
    )
  }

  return (
    <button
      onClick={onRequest}
      disabled={requestPending}
      className="text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded"
    >
      Request presenter
    </button>
  )
}
```

- [ ] **Step 5: Implement `components/meetings/FollowBanner.tsx`**

```tsx
'use client'

type Props = {
  presenterName: string
  onBrowseFreely: () => void
}

export function FollowBanner({ presenterName, onBrowseFreely }: Props) {
  return (
    <div className="px-3 py-1 bg-blue-900/50 border-b border-blue-700 flex items-center justify-between text-xs">
      <span className="text-blue-300">Following {presenterName}</span>
      <button onClick={onBrowseFreely} className="text-blue-400 underline hover:text-blue-200">
        Browse freely
      </button>
    </div>
  )
}
```

- [ ] **Step 6: Implement `components/meetings/PresenterRequestToast.tsx`**

```tsx
'use client'

type Props = {
  requesterName: string
  onYield: () => void
  onDecline: () => void
}

export function PresenterRequestToast({ requesterName, onYield, onDecline }: Props) {
  return (
    <div className="fixed bottom-24 right-4 bg-neutral-800 border border-neutral-600 rounded-lg p-4 shadow-xl z-50 max-w-xs">
      <p className="text-white text-sm mb-3">
        <span className="font-medium">{requesterName}</span> wants to present
      </p>
      <div className="flex gap-2">
        <button
          onClick={onYield}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1.5 rounded"
        >
          Yield
        </button>
        <button
          onClick={onDecline}
          className="flex-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs px-3 py-1.5 rounded"
        >
          Decline
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 7: Run tests — expect PASS**

```bash
npx vitest run __tests__/components/meetings/PresenterControls.test.tsx
```

- [ ] **Step 8: Commit**

```bash
git add components/meetings/PresenceBar.tsx components/meetings/PresenterControls.tsx \
  components/meetings/FollowBanner.tsx components/meetings/PresenterRequestToast.tsx \
  __tests__/components/meetings/PresenterControls.test.tsx
git commit -m "feat: add presence bar, presenter controls, follow banner, request toast"
```

---

## Task 12: NotesDrawer + EndMeetingButton

**Files:**
- Create: `components/meetings/NotesDrawer.tsx`
- Create: `components/meetings/EndMeetingButton.tsx`
- Create: `__tests__/components/meetings/NotesDrawer.test.tsx`
- Create: `__tests__/components/meetings/EndMeetingButton.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/meetings/NotesDrawer.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { NoteWithAuthors } from '@/lib/types/domain'

vi.mock('@/lib/actions/meetings', () => ({
  addMeetingNote: vi.fn().mockResolvedValue({ id: 'note-new' }),
  hideMeetingNote: vi.fn().mockResolvedValue(undefined),
  restoreMeetingNote: vi.fn().mockResolvedValue(undefined),
}))

const makeNote = (overrides: Partial<NoteWithAuthors> = {}): NoteWithAuthors => ({
  id: 'note-1', body: 'Test note', tags: [], createdBy: 'u1', updatedBy: 'u1',
  createdAt: '2026-05-09T00:00:00Z', updatedAt: '2026-05-09T00:00:00Z',
  hiddenAt: null, materialId: null, showId: null, meetingId: 'meet-1',
  createdByName: 'Sarah', updatedByName: 'Sarah',
  ...overrides,
})

describe('NotesDrawer', () => {
  it('is collapsed by default — notes not visible', async () => {
    const { NotesDrawer } = await import('@/components/meetings/NotesDrawer')
    render(<NotesDrawer meetingId="meet-1" notes={[makeNote()]} />)
    expect(screen.queryByText('Test note')).not.toBeInTheDocument()
  })

  it('expands when toggle button clicked', async () => {
    const { NotesDrawer } = await import('@/components/meetings/NotesDrawer')
    render(<NotesDrawer meetingId="meet-1" notes={[makeNote()]} />)
    fireEvent.click(screen.getByText(/Notes/i))
    expect(screen.getByText('Test note')).toBeInTheDocument()
  })

  it('shows note composer when expanded', async () => {
    const { NotesDrawer } = await import('@/components/meetings/NotesDrawer')
    render(<NotesDrawer meetingId="meet-1" notes={[]} />)
    fireEvent.click(screen.getByText(/Notes/i))
    expect(screen.getByPlaceholderText(/Add a note/i)).toBeInTheDocument()
  })
})
```

```tsx
// __tests__/components/meetings/EndMeetingButton.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('@/lib/actions/meetings', () => ({
  endMeeting: vi.fn().mockResolvedValue(undefined),
}))

describe('EndMeetingButton', () => {
  it('renders when canManage is true', async () => {
    const { EndMeetingButton } = await import('@/components/meetings/EndMeetingButton')
    render(<EndMeetingButton meetingId="meet-1" canManage={true} onEnd={vi.fn()} />)
    expect(screen.getByText(/End Meeting/i)).toBeInTheDocument()
  })

  it('renders nothing when canManage is false', async () => {
    const { EndMeetingButton } = await import('@/components/meetings/EndMeetingButton')
    const { container } = render(
      <EndMeetingButton meetingId="meet-1" canManage={false} onEnd={vi.fn()} />
    )
    expect(container.firstChild).toBeNull()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/components/meetings/NotesDrawer.test.tsx __tests__/components/meetings/EndMeetingButton.test.tsx
```

- [ ] **Step 3: Implement `components/meetings/NotesDrawer.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import ReactMarkdown from 'react-markdown'
import { addMeetingNote, hideMeetingNote, restoreMeetingNote } from '@/lib/actions/meetings'
import type { NoteWithAuthors } from '@/lib/types/domain'

type Props = {
  meetingId: string
  notes: NoteWithAuthors[]
}

export function NotesDrawer({ meetingId, notes }: Props) {
  const [open, setOpen] = useState(false)
  const [body, setBody] = useState('')
  const [isPending, startTransition] = useTransition()

  function submit() {
    if (!body.trim()) return
    startTransition(async () => {
      await addMeetingNote(meetingId, body.trim())
      setBody('')
    })
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-neutral-400 hover:text-white px-3 py-1.5 rounded bg-neutral-800 border border-neutral-700"
      >
        Notes {open ? '↓' : '↑'}
      </button>

      {open && (
        <div className="absolute bottom-14 left-0 right-0 bg-neutral-900 border-t border-neutral-700 p-4 max-h-56 overflow-y-auto">
          <div className="space-y-2 mb-3">
            {notes.filter((n) => !n.hiddenAt).map((n) => (
              <div key={n.id} className="bg-neutral-800 rounded px-3 py-2 flex gap-2 text-sm">
                <span className="text-neutral-500 text-xs flex-shrink-0 mt-0.5">{n.createdByName}</span>
                <div className="prose prose-invert prose-xs flex-1 min-w-0">
                  <ReactMarkdown>{n.body}</ReactMarkdown>
                </div>
                <button
                  onClick={() => startTransition(() => hideMeetingNote(n.id))}
                  className="text-neutral-600 hover:text-neutral-400 text-xs flex-shrink-0"
                >
                  hide
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && submit()}
              placeholder="Add a note..."
              className="flex-1 bg-neutral-800 border border-neutral-700 rounded px-3 py-1.5 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={submit}
              disabled={isPending || !body.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded"
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Implement `components/meetings/EndMeetingButton.tsx`**

```tsx
'use client'

import { useTransition } from 'react'
import { endMeeting } from '@/lib/actions/meetings'

type Props = {
  meetingId: string
  canManage: boolean
  onEnd: () => void
}

export function EndMeetingButton({ meetingId, canManage, onEnd }: Props) {
  const [isPending, startTransition] = useTransition()

  if (!canManage) return null

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await endMeeting(meetingId)
          onEnd()
        })
      }
      disabled={isPending}
      className="text-xs bg-red-900/40 hover:bg-red-900/70 border border-red-800 text-red-400 px-3 py-1.5 rounded disabled:opacity-40"
    >
      End Meeting
    </button>
  )
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx vitest run __tests__/components/meetings/NotesDrawer.test.tsx __tests__/components/meetings/EndMeetingButton.test.tsx
```

- [ ] **Step 6: Commit**

```bash
git add components/meetings/NotesDrawer.tsx components/meetings/EndMeetingButton.tsx \
  __tests__/components/meetings/NotesDrawer.test.tsx __tests__/components/meetings/EndMeetingButton.test.tsx
git commit -m "feat: add NotesDrawer and EndMeetingButton with tests"
```

---

## Task 13: MeetingRoom root component

**Files:**
- Create: `components/meetings/MeetingRoom.tsx`

No unit tests — this component is an integration of all previous pieces and Liveblocks hooks. Covered by manual QA.

- [ ] **Step 1: Implement `components/meetings/MeetingRoom.tsx`**

```tsx
'use client'

import { useEffect, useRef, useCallback } from 'react'
import {
  RoomProvider, useStorage, useMutation, useOthers, useSelf,
  useUpdateMyPresence, INITIAL_STORAGE,
} from '@/lib/liveblocks.config'
import {
  claimPresenter, requestPresenter, yieldPresenter,
  clearPresenterRequest, releasePresenter,
  setActiveMaterials, setPanelSizes, setFilters,
} from '@/lib/liveblocks/mutations'
import { filterMaterials } from '@/lib/liveblocks/filters'
import { startMeeting } from '@/lib/actions/meetings'
import { JoinPrompt } from '@/components/meetings/JoinPrompt'
import { LightTable } from '@/components/meetings/LightTable'
import { Filmstrip } from '@/components/meetings/Filmstrip'
import { PresenceBar } from '@/components/meetings/PresenceBar'
import { PresenterControls } from '@/components/meetings/PresenterControls'
import { FollowBanner } from '@/components/meetings/FollowBanner'
import { PresenterRequestToast } from '@/components/meetings/PresenterRequestToast'
import { NotesDrawer } from '@/components/meetings/NotesDrawer'
import { EndMeetingButton } from '@/components/meetings/EndMeetingButton'
import type { Material, NoteWithAuthors } from '@/lib/types/domain'
import type { LBPresence } from '@/lib/liveblocks.config'

type Props = {
  showId: string
  meetingId: string
  meetingTitle: string
  showName: string
  materials: Material[]
  notes: NoteWithAuthors[]
  departments: { id: string; name: string }[]
  canManage: boolean
  selfUserId: string
  selfName: string
}

function MeetingRoomInner({
  showId, meetingId, meetingTitle, showName,
  materials, notes, departments, canManage,
  selfUserId, selfName,
}: Props) {
  const updatePresence = useUpdateMyPresence()
  const self = useSelf()
  const others = useOthers()

  const presenterId = useStorage((root) => root.presenter_id)
  const presenterRequest = useStorage((root) => root.presenter_request)
  const activeMeetingId = useStorage((root) => root.active_meeting_id)
  const activeMaterialIds = useStorage((root) => root.active_material_ids)
  const panelSizes = useStorage((root) => root.panel_sizes)
  const filters = useStorage((root) => root.filters)

  const selfMode = self?.presence.mode ?? null
  const hasJoined = selfMode !== null
  const isSelfPresenter = presenterId === selfUserId
  const isFollowing = selfMode === 'follow' && presenterId !== null && !isSelfPresenter

  // Start meeting on first join
  const startedRef = useRef(false)
  const activeMeetingMutation = useMutation(({ storage }, id: string) => {
    storage.set('active_meeting_id', id)
  }, [])

  useEffect(() => {
    if (!hasJoined || startedRef.current) return
    startedRef.current = true
    if (!activeMeetingId) {
      startMeeting(meetingId).then(() => {
        activeMeetingMutation(meetingId)
      })
    }
  }, [hasJoined, activeMeetingId, meetingId, activeMeetingMutation])

  // Presenter disconnect cleanup — oldest member (lowest joined_at) acts
  const allPresences = others.map((o) => o.presence)
  const selfJoinedAt = self?.presence.joined_at ?? Infinity
  const isOldest = allPresences.every((p) => selfJoinedAt <= p.joined_at)

  const cleanupPresenter = useMutation(({ storage }, disconnectedId: string) => {
    if (storage.get('presenter_id') === disconnectedId) {
      storage.set('presenter_id', null)
    }
    const req = storage.get('presenter_request')
    if (req?.from_user_id === disconnectedId) {
      storage.set('presenter_request', null)
    }
  }, [])

  const prevOtherIds = useRef<Set<string>>(new Set())
  useEffect(() => {
    const currentIds = new Set(others.map((o) => o.id))
    for (const id of prevOtherIds.current) {
      if (!currentIds.has(id) && isOldest) {
        cleanupPresenter(id)
      }
    }
    prevOtherIds.current = currentIds
  }, [others, isOldest, cleanupPresenter])

  // Liveblocks mutations
  const mutClaim = useMutation(({ storage }) => claimPresenter(storage, selfUserId), [selfUserId])
  const mutRequest = useMutation(({ storage }) => requestPresenter(storage, selfUserId), [selfUserId])
  const mutYield = useMutation(({ storage }) => yieldPresenter(storage), [])
  const mutDecline = useMutation(({ storage }) => clearPresenterRequest(storage), [])
  const mutRelease = useMutation(({ storage }) => releasePresenter(storage), [])
  const mutSetMaterials = useMutation(
    ({ storage }, ids: string[], sizes?: number[]) => setActiveMaterials(storage, ids, sizes),
    []
  )
  const mutSetPanelSizes = useMutation(
    ({ storage }, sizes: number[]) => setPanelSizes(storage, sizes),
    []
  )
  const mutSetFilters = useMutation(
    ({ storage }, f: typeof filters) => { if (f) setFilters(storage, f) },
    []
  )
  const mutClearMeeting = useMutation(({ storage }) => {
    storage.set('active_meeting_id', null)
  }, [])

  // Effective light table state — follow mode mirrors presenter's storage
  const effectiveIds = isFollowing ? (activeMaterialIds ?? []) : (activeMaterialIds ?? [])
  const effectiveSizes = panelSizes ?? []
  const effectiveFilters = filters ?? { department_ids: [], tags: [], states: [] }

  const visibleMaterials = filterMaterials(materials, effectiveFilters)
  const lightTableMaterials = materials.filter((m) => effectiveIds.includes(m.id))

  function handleToggleMaterial(id: string) {
    if (isFollowing) return
    const current = activeMaterialIds ?? []
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
    mutSetMaterials(next)
  }

  function handleJoin(mode: 'browse' | 'follow') {
    updatePresence({ user_id: selfUserId, current_material_id: null, mode, joined_at: Date.now() })
  }

  // Presence bar data
  const allMembers = [
    ...(self ? [{ userId: self.id, presence: self.presence, info: self.info }] : []),
    ...others.map((o) => ({ userId: o.id, presence: o.presence, info: o.info })),
  ]
  const presenceBarMembers = allMembers.map((m) => ({
    userId: m.userId,
    name: m.info?.name ?? 'Unknown',
    initials: m.info?.initials ?? '?',
    isPresenter: m.userId === presenterId,
    mode: m.presence.mode,
  }))

  const presenterInfo = allMembers.find((m) => m.userId === presenterId)
  const requesterInfo = allMembers.find((m) => m.userId === presenterRequest?.from_user_id)

  // Meeting ended
  const isMeetingEnded = activeMeetingId === null && hasJoined && startedRef.current

  // Keyboard navigation
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && isFollowing) {
        updatePresence({ mode: 'browse' })
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        if (isFollowing) return
        const current = activeMaterialIds ?? []
        if (current.length !== 1) return
        const idx = visibleMaterials.findIndex((m) => m.id === current[0])
        const nextIdx = e.key === 'ArrowRight' ? idx + 1 : idx - 1
        const next = visibleMaterials[nextIdx]
        if (next) mutSetMaterials([next.id])
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isFollowing, activeMaterialIds, visibleMaterials, mutSetMaterials, updatePresence])

  if (!hasJoined) {
    return <JoinPrompt onJoin={handleJoin} />
  }

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Top bar */}
      <div className="bg-neutral-900 border-b border-neutral-700 px-4 py-2 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-neutral-500 text-sm">{showName}</span>
          <span className="text-neutral-600">·</span>
          <span className="text-white text-sm font-medium">{meetingTitle}</span>
          <span className="bg-red-900/40 border border-red-800 text-red-400 text-xs px-1.5 py-0.5 rounded">
            ● Live
          </span>
        </div>
        <EndMeetingButton
          meetingId={meetingId}
          canManage={canManage}
          onEnd={mutClearMeeting}
        />
      </div>

      {/* Follow banner */}
      {isFollowing && presenterInfo && (
        <FollowBanner
          presenterName={presenterInfo.info?.name ?? 'Presenter'}
          onBrowseFreely={() => updatePresence({ mode: 'browse' })}
        />
      )}

      {/* Meeting ended banner */}
      {isMeetingEnded && (
        <div className="bg-neutral-800 border-b border-neutral-600 px-4 py-2 text-sm text-neutral-400 text-center">
          Meeting ended — browsing freely
        </div>
      )}

      {/* Light table */}
      <div className="flex-1 overflow-hidden p-2">
        <LightTable
          materials={lightTableMaterials}
          panelSizes={effectiveSizes}
          onPanelResize={isSelfPresenter ? mutSetPanelSizes : () => {}}
        />
      </div>

      {/* Bottom strip */}
      <div className="bg-neutral-900 border-t border-neutral-700 px-3 py-2 flex items-center gap-3 flex-shrink-0 relative">
        <div className="flex-1 overflow-hidden">
          <Filmstrip
            materials={visibleMaterials}
            activeMaterialIds={effectiveIds}
            onToggle={handleToggleMaterial}
            filters={effectiveFilters}
            onFilterChange={isSelfPresenter || !isFollowing ? (f) => mutSetFilters(f) : () => {}}
            departments={departments}
          />
        </div>
        <div className="w-px h-8 bg-neutral-700 flex-shrink-0" />
        <PresenceBar members={presenceBarMembers} />
        <div className="w-px h-8 bg-neutral-700 flex-shrink-0" />
        <PresenterControls
          presenterId={presenterId ?? null}
          presenterRequest={presenterRequest ?? null}
          selfUserId={selfUserId}
          onClaim={mutClaim}
          onRequest={mutRequest}
          onRelease={mutRelease}
        />
        <div className="w-px h-8 bg-neutral-700 flex-shrink-0" />
        <NotesDrawer meetingId={meetingId} notes={notes} />
      </div>

      {/* Presenter request toast */}
      {isSelfPresenter && presenterRequest && requesterInfo && (
        <PresenterRequestToast
          requesterName={requesterInfo.info?.name ?? 'Someone'}
          onYield={mutYield}
          onDecline={mutDecline}
        />
      )}
    </div>
  )
}

export function MeetingRoom(props: Props) {
  return (
    <RoomProvider
      id={`show-${props.showId}`}
      initialPresence={{ user_id: props.selfUserId, current_material_id: null, mode: 'browse' as const, joined_at: 0 }}
      initialStorage={INITIAL_STORAGE}
    >
      <MeetingRoomInner {...props} />
    </RoomProvider>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/meetings/MeetingRoom.tsx
git commit -m "feat: add MeetingRoom root component with Liveblocks integration"
```

---

## Task 14: Meeting list page + room page

**Files:**
- Create: `app/(app)/[orgSlug]/shows/[showSlug]/meetings/page.tsx`
- Create: `app/(app)/[orgSlug]/shows/[showSlug]/meetings/[meetingId]/page.tsx`

- [ ] **Step 1: Implement meeting list page**

```tsx
// app/(app)/[orgSlug]/shows/[showSlug]/meetings/page.tsx
import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getMeetingsByShow } from '@/lib/data/meetings'
import { getShowBySlug } from '@/lib/data/shows'
import { getOrgBySlug } from '@/lib/data/orgs'
import { createMeeting } from '@/lib/actions/meetings'

type Props = {
  params: Promise<{ orgSlug: string; showSlug: string }>
}

export default async function MeetingsPage({ params }: Props) {
  const { orgSlug, showSlug } = await params
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const org = await getOrgBySlug(orgSlug)
  if (!org) redirect('/dashboard')
  const show = await getShowBySlug(org, showSlug)
  if (!show) redirect(`/${orgSlug}`)

  const meetings = await getMeetingsByShow(show.id)

  const selfMember = show.show_members.find((m: any) => m.user_id === user.id)
  const canManage = (selfMember?.role_definitions as any)?.permissions?.includes('can_manage_show') ?? false

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-white text-xl font-semibold">Meetings — {show.name}</h1>
      </div>

      {canManage && (
        <form
          action={async (fd: FormData) => {
            'use server'
            const title = fd.get('title') as string
            const scheduledAt = fd.get('scheduled_at') as string
            await createMeeting(show.id, title, new Date(scheduledAt).toISOString())
          }}
          className="mb-8 bg-neutral-900 border border-neutral-700 rounded-lg p-4 space-y-3"
        >
          <h2 className="text-white text-sm font-medium">Schedule a meeting</h2>
          <input
            name="title"
            required
            placeholder="Meeting title"
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white placeholder-neutral-500"
          />
          <input
            name="scheduled_at"
            type="datetime-local"
            required
            className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm px-4 py-2 rounded"
          >
            Schedule
          </button>
        </form>
      )}

      <div className="space-y-2">
        {meetings.length === 0 && (
          <p className="text-neutral-500 text-sm">No meetings scheduled yet.</p>
        )}
        {meetings.map((m) => (
          <a
            key={m.id}
            href={`/${orgSlug}/shows/${showSlug}/meetings/${m.id}`}
            className="block bg-neutral-900 border border-neutral-700 hover:border-neutral-500 rounded-lg p-4 transition-colors"
          >
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium">{m.title}</span>
              {m.endedAt ? (
                <span className="text-neutral-500 text-xs">Ended</span>
              ) : m.startedAt ? (
                <span className="text-green-400 text-xs">● Live</span>
              ) : (
                <span className="text-neutral-400 text-xs">
                  {new Date(m.scheduledAt).toLocaleString()}
                </span>
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implement meeting room page**

```tsx
// app/(app)/[orgSlug]/shows/[showSlug]/meetings/[meetingId]/page.tsx
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

  const [notes, materials] = await Promise.all([
    getNotesByMeeting(meetingId),
    getMaterialsByShow(show.id),
  ])

  const selfMember = show.show_members.find((m: any) => m.user_id === user.id)
  const canManage = (selfMember?.role_definitions as any)?.permissions?.includes('can_manage_show') ?? false

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()
  const selfName = profile?.display_name ?? user.email ?? 'You'

  const departments = show.departments.map((d: any) => ({ id: d.id, name: d.name }))

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
      selfName={selfName}
    />
  )
}
```

- [ ] **Step 3: Check that `getMaterialsByShow` exists in `lib/data/materials.ts`. If it does not, add it:**

```ts
export const getMaterialsByShow = cache(async (showId: string): Promise<Material[]> => {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('materials')
    .select('id, department_id, uploaded_by, type, state, title, description, url, storage_path, body, tags, created_at')
    .in(
      'department_id',
      supabase.from('departments').select('id').eq('show_id', showId)
    )
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map((row) => ({
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
  }))
})
```

- [ ] **Step 4: Run full test suite — expect PASS**

```bash
npx vitest run
```

Expected: all tests pass. Investigate and fix any failures before continuing.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/\[orgSlug\]/shows/\[showSlug\]/meetings/
git commit -m "feat: add meeting list page and meeting room page"
```

---

## Task 15: Final wiring + smoke test

- [ ] **Step 1: Add link to meetings from the show detail page**

In the show detail page (find it under `app/(app)/[orgSlug]/shows/[showSlug]/page.tsx`), add a link:

```tsx
<a href={`/${orgSlug}/shows/${showSlug}/meetings`} className="text-blue-400 hover:underline text-sm">
  Meetings
</a>
```

- [ ] **Step 2: Start dev server and manually test the golden path**

```bash
npm run dev
```

Walk through:
1. Log in, navigate to a show → click Meetings link → meeting list page loads
2. As a `can_manage_show` member, schedule a meeting → it appears in the list
3. Click meeting → join prompt appears → choose "Browse freely"
4. Open a second browser tab (different user) → join as viewer
5. First user adds materials to light table → second user sees the same materials after claiming presenter
6. Request presenter from the viewer tab → toast appears for presenter → yield → viewer becomes presenter
7. Presenter resizes panels → viewer sees the same sizes
8. Apply a filter → viewer's filmstrip updates
9. Use ← → arrows to navigate filmstrip
10. Press Escape to exit follow mode
11. Add a meeting note → it appears in the drawer
12. End meeting (can_manage_show only) → banner appears for all connected members

- [ ] **Step 3: Commit any fixes from smoke test**

```bash
git add -A
git commit -m "fix: smoke test corrections for meeting mode"
```

- [ ] **Step 4: Run full test suite one final time**

```bash
npx vitest run
```

Expected: all tests pass.

---

## Self-Review Notes

**Spec coverage check:**
- ✓ Pre-created meetings (Task 7 + 14)
- ✓ `can_manage_show` gated create/end (Task 7)
- ✓ Join prompt browse/follow (Task 8 + 13)
- ✓ Presenter claim/request/yield/release/timeout (Task 11 + 13)
- ✓ Disconnect cleanup — oldest member pattern (Task 13)
- ✓ Light table 1–4 panels, resizable (Task 9)
- ✓ Filmstrip multi-select, max 4 (Task 10)
- ✓ Filters synced to followers (Task 13)
- ✓ Panel sizes synced to followers (Task 13)
- ✓ Notes drawer add/hide during + after (Task 12)
- ✓ End meeting → `ended_at` + clears `active_meeting_id` (Task 12 + 13)
- ✓ Keyboard ← → navigation, Escape exits follow (Task 13)
- ✓ Liveblocks auth endpoint (Task 3)
- ✓ Migration + RLS (Task 2)

**Presenter request timeout (30s):** The spec requires a client-side 30s timer that calls `clearPresenterRequest` if the current presenter doesn't respond. This is handled in `MeetingRoom` — add a `useEffect` that starts a 30s timer whenever `presenterRequest` is set and the current user is the requester:

Add to `MeetingRoomInner` after the existing `useEffect`s:

```ts
useEffect(() => {
  if (!presenterRequest || presenterRequest.from_user_id !== selfUserId) return
  const id = setTimeout(() => mutDecline(), 30_000)
  return () => clearTimeout(id)
}, [presenterRequest, selfUserId, mutDecline])
```

Add this to `MeetingRoom.tsx` in Task 13 before committing.
