# Plan 4: Notes System

**Date:** 2026-05-09
**Status:** Approved

---

## Overview

Adds a Notes system for annotating materials and shows. Notes are distinct from the `note` material type — a `note` material is a design artifact that participates in the annealing lifecycle; a Note is commentary attached to an entity. Notes support markdown, tags, soft deletion, and are editable by any org member.

Plan 4 covers material notes and show notes. Meeting notes are deferred to Plan 5 (real-time meeting mode), but the `meeting_id` FK is included in the schema so Plan 5 can plug straight in.

---

## Database Schema

### New table: `notes`

| Column | Type | Notes |
|---|---|---|
| id | uuid pk | default `gen_random_uuid()` |
| body | text | markdown |
| tags | text[] | default `'{}'` |
| created_by | uuid → profiles | on delete restrict |
| updated_by | uuid → profiles | on delete restrict |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |
| hidden_at | timestamptz | null = visible; non-null = soft-deleted |
| material_id | uuid → materials | nullable; on delete cascade |
| show_id | uuid → shows | nullable; on delete cascade |
| meeting_id | uuid | nullable; no FK in Plan 4 — `meetings` table doesn't exist yet |

**Constraint:** `CHECK (num_nonnulls(material_id, show_id, meeting_id) = 1)` — exactly one attachment per note. In Plan 4 `meeting_id` is always null, so the constraint reduces to exactly one of `material_id`/`show_id`. Plan 5 adds `ALTER TABLE notes ADD CONSTRAINT notes_meeting_id_fkey FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE CASCADE`.

**Indexes:** `material_id`, `show_id`, `meeting_id`, `created_by`.

### RLS Policies

RLS enabled. No DELETE policy — soft delete only via `hidden_at`.

| Operation | Allowed when |
|---|---|
| SELECT | user is org member (via attachment → org) |
| INSERT | user is org member; `created_by = auth.uid()` |
| UPDATE | user is org member |

For material-attached notes, org membership resolves via `materials → departments → shows → org_members`. For show-attached notes, via `shows → org_members`.

---

## TypeScript Types

### `lib/types/domain.ts` additions

```ts
export type Note = {
  id: string
  body: string
  tags: string[]
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  hiddenAt: string | null
  materialId: string | null
  showId: string | null
  meetingId: string | null
}

export type NoteWithAuthors = Note & {
  createdByName: string
  updatedByName: string
}
```

### `lib/types/db.ts` additions

New `notes` table entry with Row/Insert/Update matching the schema above.

---

## Data Access Layer

**`lib/data/notes.ts`** (new):

```ts
export const getNotesByMaterial = cache(
  async (materialId: string): Promise<NoteWithAuthors[]>
)

export const getNotesByShow = cache(
  async (showId: string): Promise<NoteWithAuthors[]>
)
```

Both functions:
- Join `profiles` twice: once for `created_by`, once for `updated_by`, to resolve display names
- Return all notes including hidden ones (UI controls visibility via `hiddenAt`)
- Order by `created_at` ascending (oldest first — chronological thread)

---

## Server Actions

**`lib/actions/notes.ts`** (new):

```ts
createNote(
  attachment: { materialId: string } | { showId: string },
  data: { body: string; tags?: string[] }
): Promise<{ id: string }>

updateNote(
  noteId: string,
  data: { body: string; tags?: string[] }
): Promise<void>

hideNote(noteId: string): Promise<void>    // sets hidden_at = now() only
restoreNote(noteId: string): Promise<void> // sets hidden_at = null only
```

All actions:
- Auth guard first (`getUser()` before any DB read)
- RLS enforces org membership
- `updateNote` sets `updated_by = auth.uid()` and `updated_at = now()`
- `hideNote`/`restoreNote` only modify `hidden_at` — they do not update `updated_by` or `updated_at` so the "last edited" attribution reflects body/tag changes only
- All call `revalidatePath('', 'layout')` on success

---

## UI

### Shared component — `components/NoteList.tsx`

Client Component. Used in both the material detail panel and the show page.

**Props:**
```ts
type Props = {
  notes: NoteWithAuthors[]
  attachment: { materialId: string } | { showId: string }
}
```

**Behavior:**
- `+ Add note` composer at top: markdown textarea + comma-separated tags input + Submit
- Notes listed oldest-first below the composer
- Each note shows:
  - Rendered markdown body (`react-markdown`)
  - Tags as badges
  - Author name + relative timestamp (`created_by` name + `created_at`)
  - If edited: "edited by [name]" attribution line
  - Edit button → inline edit mode (textarea replaces rendered markdown, tags input, Save/Cancel)
  - Hide button → calls `hideNote`; note collapses to a muted "hidden" placeholder
- Hidden notes: collapsed by default; "Show hidden (N)" toggle at bottom of list reveals them with a restore button

### Material detail panel

`app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.tsx` changes:
- Calls `getNotesByMaterial` for each material in the department server-side
- Passes `notesByMaterial: Record<string, NoteWithAuthors[]>` to `DepartmentClient`

`DepartmentClient.tsx` changes:
- `DetailPanel` receives `notes: NoteWithAuthors[]` (the slice for the selected material)
- Renders `<NoteList notes={notes} attachment={{ materialId: selected.id }} />` below the existing content section (image preview / file link / URL / note body)

### Show page

`app/(app)/[orgSlug]/shows/[showSlug]/page.tsx` changes:
- Calls `getNotesByShow(show.id)` server-side
- Renders new `ShowNotesSection` below the departments list

New `app/(app)/[orgSlug]/shows/[showSlug]/ShowNotesSection.tsx`:
- Client Component; thin wrapper around `NoteList`
- Props: `notes: NoteWithAuthors[]`, `showId: string`
- Renders a section header ("Show Notes") then `<NoteList notes={notes} attachment={{ showId }} />`

---

## Dependencies

- `react-markdown` — markdown rendering in `NoteList`

---

## Out of Scope for Plan 4

- Meeting notes (Plan 5 — requires meeting records)
- Note reactions or threading
- Notifications when notes are added
- Full-text search across notes
- Rich text editor (markdown textarea only)
