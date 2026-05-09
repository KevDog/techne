# Plan 3: Materials + Annealing Workflow

**Date:** 2026-05-09
**Status:** Approved
**Plan file:** TBD (`docs/plans/`)

---

## Overview

Adds the materials layer to the existing org → season → show → department hierarchy. Members upload images, files, links, and notes to departments. Materials move through a three-state annealing lifecycle (exploratory → proposed → decided). The department page becomes navigable; materials are browsed in a flat list with a slide-over detail panel.

---

## Database Schema

### Altered tables

**`departments`** — add slug:

```sql
-- 1. Add nullable to allow backfill before constraint
alter table public.departments
  add column slug text;

-- 2. Backfill: lowercase, collapse non-alphanumeric runs to hyphens, trim
update public.departments
  set slug = lower(trim(both '-' from regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')));

-- 3. Lock it down
alter table public.departments
  alter column slug set not null;

alter table public.departments
  add constraint departments_show_id_slug_key unique (show_id, slug);
```

**Slug generation rule:** lowercase, non-alphanumeric runs → `-`, leading/trailing hyphens stripped. Examples: `Scenic Design` → `scenic-design`, `Hair & Makeup` → `hair-makeup`. New departments generate their slug with the same rule at insert time in the application layer.

### New tables

**`materials`**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | internal only |
| department_id | uuid → departments | cascade delete |
| uploaded_by | uuid → profiles | restrict delete |
| type | text | `'image' \| 'file' \| 'link' \| 'note'` |
| state | text | `'exploratory' \| 'proposed' \| 'decided'` default `'exploratory'` |
| title | text | |
| description | text | nullable |
| url | text | nullable — `link` type only |
| storage_path | text | nullable — `image` and `file` types only |
| body | text | nullable — `note` type only |
| tags | text[] | default `'{}'` |
| created_at | timestamptz | default now() |

Indexes: `department_id`, `uploaded_by`, `state`.

### Slug strategy

| Table | Constraint | In URL |
| --- | --- | --- |
| departments | unique(show_id, slug) | ✓ `/[orgSlug]/shows/[showSlug]/departments/[deptSlug]` |
| materials | — (no URL) | ✗ detail is inline |

---

## Supabase Storage

- **Bucket:** `materials` (private — no public access)
- **Path pattern:** `{org_id}/{show_id}/{dept_id}/{material_id}/{filename}`
- **Upload flow:** browser uploads directly to Supabase Storage using the user's session token; a Server Action creates the DB record afterward
- **Display:** signed URLs generated server-side per request (short TTL)

---

## RLS Policies

`materials` has RLS enabled. Plan 3 adds SELECT, INSERT, UPDATE, and DELETE policies.

| Operation | Allowed when |
| --- | --- |
| SELECT | user is member of the material's org (via departments → shows → org_members) |
| INSERT | user is member of the material's org |
| UPDATE | user is member of the material's org |
| DELETE | `uploaded_by = auth.uid()` OR user has `can_manage_show` permission (app layer checks; DB policy allows org members) |

State transition validity (e.g. respecting `allow_reopen`) is enforced at the application layer, not in RLS.

---

## Annealing State Machine

```
exploratory  →  proposed  →  decided
                               ↓  (only if show.allow_reopen = true)
                            proposed
```

| Transition | Allowed when |
| --- | --- |
| exploratory → proposed | any org member |
| proposed → decided | any org member (single approval mode) |
| decided → proposed | any org member, only if `show.allow_reopen = true` |
| proposed → exploratory | not allowed |

Multi-approval tracking (requiring specific roles to sign off) is deferred to a later plan. Shows with `approval_mode = 'multi'` behave identically to `'single'` in Plan 3.

---

## TypeScript Types

`lib/types/domain.ts` additions:

```ts
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

`Department` type in `domain.ts` gains a `slug` field:

```ts
export type Department = {
  id: string
  showId: string
  name: string
  slug: string
  createdAt: string
}
```

`lib/types/db.ts` additions:

- `departments.Row/Insert/Update` — add `slug: string`
- New `materials` table entry with Row/Insert/Update matching the schema above

---

## Routing

```text
app/
  (app)/
    [orgSlug]/
      shows/[showSlug]/
        page.tsx                          ← update: dept rows become Links
        departments/
          [deptSlug]/
            page.tsx                      ← new: materials list
```

`[orgSlug]/layout.tsx` remains the org trust boundary. The department page resolves the org via `getOrgBySlug` (deduplicated by `React.cache()`), the show via `getShowBySlug`, and the department via `getDepartmentBySlug`.

---

## Data Access Layer

**`lib/data/departments.ts`** (new):

```ts
export const getDepartmentBySlug = cache(
  async (show: Show, slug: string): Promise<Department | null>
)
```

**`lib/data/materials.ts`** (new):

```ts
export type MaterialWithUrl = Material & { signedUrl: string | null }

export const getMaterialsByDepartment = cache(
  async (dept: Department): Promise<MaterialWithUrl[]>
)
```

`getMaterialsByDepartment` generates a short-lived signed URL for each `image` or `file` material. `link` and `note` types return `signedUrl: null`.

---

## Server Actions

**`lib/actions/materials.ts`**:

```ts
createMaterial(deptId: string, type: MaterialType, data: {
  title: string
  description?: string
  url?: string          // link type
  storagePath?: string  // image/file type (upload already complete)
  body?: string         // note type
  tags?: string[]
}): Promise<{ id: string }>

transitionState(materialId: string, targetState: MaterialState): Promise<void>

updateTags(materialId: string, tags: string[]): Promise<void>

deleteMaterial(materialId: string): Promise<void>
// also removes the Supabase Storage file if storagePath is set
```

All actions call `createSupabaseServerClient()` and let RLS enforce org membership. `transitionState` validates the transition is legal before updating. `deleteMaterial` verifies `uploaded_by = auth.uid()` before proceeding (RLS handles the DB row; the action handles the Storage file).

---

## UI

### Show detail page update — `/[orgSlug]/shows/[showSlug]`

Department rows change from static `<li>` to `<Link href={...}>`. Slug is now available on each department.

### Department page — `/[orgSlug]/shows/[showSlug]/departments/[deptSlug]`

Server Component. Layout:

- **Header:** breadcrumb (Org / Shows / Show Name / Dept Name) + `+ Add Material` button
- **State tabs:** All · Decided · Proposed · Exploratory (with counts)
- **Materials list:** flat, newest first, filtered by active tab
  - Image rows: 48×48 thumbnail + title + state badge + type badge + tags
  - Non-image rows: type icon (🔗 / 📄 / 📝) + title + state badge + type badge + tags

Clicking any row opens the detail slide-over. The page itself does not re-render.

### Upload slide-over (Client Component)

Triggered by `+ Add Material`. Contains:

- Type selector: Image / File / Link / Note
- Conditional fields:
  - Image/File: file picker → uploads directly to Supabase Storage → `storage_path` captured
  - Link: URL input
  - Note: text area (`body`)
- Title (required), description (optional), tags (comma-separated, optional)
- Submit → `createMaterial` Server Action → page revalidates

### Material detail slide-over (Client Component)

Opens on row click. Contains:

- Title + state badge + type badge
- Content area: image preview (signed URL), file download link, external link, or note body
- Tags with inline `+ add tag`
- Uploaded by + date
- State transition button(s):
  - If exploratory: **Propose**
  - If proposed: **Approve** (→ decided)
  - If decided + `show.allow_reopen`: **Reopen** (→ proposed)

---

## Out of Scope for Plan 3

- Multi-approval tracking (`material_approvals` table, `approval_roles` on shows) — later plan
- Notes on materials (Plan 4)
- Meeting-time material grouping (Plan 5)
- Full-text search across materials — later plan
- Predefined tag lists per show — later plan
- Material editing (title, description) — later plan
- Drag-to-reorder — not planned
