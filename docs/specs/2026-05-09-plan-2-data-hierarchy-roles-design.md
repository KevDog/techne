# Plan 2: Data Hierarchy + Flexible Roles

**Date:** 2026-05-09
**Status:** Approved
**Plan file:** TBD (`docs/plans/`)

---

## Overview

Extends the Plan 1 scaffold with the full organizational data hierarchy (Org → Season → Show → Department), a flexible role system, and read-only browse UI. Users can navigate from their org's show list to a show detail page. No write operations in Plan 2 — CRUD comes in later plans.

---

## Database Schema

### Altered tables

**`orgs`** — add settings column:

```sql
settings jsonb not null default '{"claude_enabled": false}'
```

### New tables

**`seasons`**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | internal only |
| org_id | uuid → orgs | cascade delete |
| name | text | |
| slug | text | unique(org_id, slug) |
| created_at | timestamptz | default now() |

**`shows`**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | internal only |
| org_id | uuid → orgs | cascade delete |
| season_id | uuid → seasons | nullable — show need not belong to a season |
| name | text | |
| slug | text | unique(org_id, slug) — used in URL |
| approval_mode | text | 'single' \| 'multi' |
| allow_reopen | boolean | default false |
| created_at | timestamptz | default now() |

**`departments`**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | internal only |
| show_id | uuid → shows | cascade delete |
| name | text | |
| created_at | timestamptz | default now() |

**`role_definitions`**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | internal only |
| org_id | uuid → orgs | cascade delete; always set |
| show_id | uuid → shows | nullable — null = org-level default |
| name | text | |
| permissions | text[] | e.g. `['can_approve','can_upload']` |
| created_at | timestamptz | default now() |

Show-level role definitions override org defaults by name. The merged set (org defaults + show overrides, show wins on collision) is computed by the application, not the database.

**`show_members`**

| Column | Type | Notes |
| --- | --- | --- |
| id | uuid pk | internal only |
| show_id | uuid → shows | cascade delete |
| user_id | uuid → auth.users | cascade delete |
| role_definition_id | uuid → role_definitions | |
| featured | boolean | default false — at most one per show (enforced by partial unique index) |
| created_at | timestamptz | default now() |
| — | unique(show_id, user_id) | |

`UNIQUE (show_id) WHERE featured = true` — prevents multiple featured members per show at the DB level.

### Slug strategy

| Table | Constraint | In URL |
| --- | --- | --- |
| orgs | globally unique | ✓ `/[orgSlug]/...` |
| seasons | unique(org_id, slug) | future plans |
| shows | unique(org_id, slug) | ✓ `/[orgSlug]/shows/[showSlug]` |
| departments | — (no URL in Plan 2) | future plans |

UUIDs are internal PKs only and never appear in URLs.

---

## RLS Policies

All five new tables have RLS enabled. Plan 2 adds SELECT policies only — INSERT/UPDATE/DELETE come in Plan 3+.

**Access model:** org-wide visibility. Any org member can browse all shows, seasons, departments, role definitions, and show memberships within their org.

| Table | SELECT allowed when |
| --- | --- |
| seasons | user is member of `seasons.org_id` |
| shows | user is member of `shows.org_id` |
| departments | user is member of the show's org (via shows → org_members) |
| role_definitions | user is member of `role_definitions.org_id` |
| show_members | user is member of the show's org (via shows → org_members) |

---

## TypeScript Types

`lib/types/domain.ts` — additions:

```ts
export type OrgSettings = {
  claude_enabled: boolean
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
```

`lib/types/db.ts` is extended with matching Supabase row types for all five new tables.

---

## Routing

```text
app/
  (app)/
    dashboard/
      page.tsx              ← unchanged: org list, each links to /[orgSlug]/shows
    [orgSlug]/
      layout.tsx            ← resolves org from slug, 404s if user not a member
      shows/
        page.tsx            ← shows list grouped by season
        [showSlug]/
          page.tsx          ← show detail: members + departments
```

All pages are Server Components. Data fetched directly from Supabase — no API routes, no client fetching. RLS enforces access.

`[orgSlug]/layout.tsx` is the trust boundary: it resolves the org and verifies membership once. Child pages receive the org as a prop and can trust it.

---

## UI

### Dark mode

Uses Tailwind CSS v4's default `media` strategy — follows OS preference automatically. No toggle needed in Plan 2. TailwindUI components handle `dark:` variants.

### Shows list — `/[orgSlug]/shows`

Tailwind Plus stacked list pattern. Two-panel layout:

- **Left sidebar** — season filter (all seasons, per-season, unseasoned)
- **Main area** — shows grouped by season heading; each row shows:
  - Show name
  - Featured member name · department count · member count

Clicking a row navigates to `/[orgSlug]/shows/[showSlug]`.

### Show detail — `/[orgSlug]/shows/[showSlug]`

Two-column layout:

- **Left column (narrow)** — members list with avatar initials, name, and role name
- **Right column (wide)** — departments stacked list; clicking a department is a no-op in Plan 2 (materials navigation comes in Plan 3)

**Show header** — show name, season name, featured member name (breadcrumb: Org / Shows / Show Name).

### Featured member

`show_members.featured boolean default false` — the featured member's display name surfaces in the shows list subtitle. Orgs decide which member to feature; no role name is hardcoded.

---

## Out of scope for Plan 2

- Create/edit/delete for any entity (Plan 3+)
- Department-level navigation (Plan 3)
- Materials and annealing workflow (Plan 3)
- Notes (Plan 4)
- Real-time meeting mode (Plan 5)
- Agent orchestration (Plan 6)
- Manual dark/light toggle
