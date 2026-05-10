# Plan 5 — Real-Time Meeting Mode

## Overview

Live "follow the leader" design meetings for theatrical teams. Members join a pre-scheduled meeting, navigate materials on a shared light table, and optionally follow a presenter's view in real time. All live state lives in Liveblocks; Supabase holds the permanent meeting record and notes.

---

## Glossary Additions

**Light Table**
The main material viewing area in meeting mode. Displays 1–4 materials simultaneously in a resizable grid. Named after the physical light tables used in theatrical design to compare renderings and transparencies.

---

## Data Model

### Supabase: `meetings` table

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `show_id` | uuid | FK → shows |
| `title` | text | Required |
| `scheduled_at` | timestamptz | When the meeting is planned |
| `started_at` | timestamptz | Set when first member joins the room |
| `ended_at` | timestamptz | Set by `can_manage_show` member to close the meeting |
| `created_by` | uuid | FK → users |

### Supabase: `meeting_notes` table

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid | PK |
| `meeting_id` | uuid | FK → meetings |
| `author_id` | uuid | FK → users |
| `body` | text | Markdown |
| `created_at` | timestamptz | |
| `hidden_at` | timestamptz | Soft delete — null = visible |

Same soft-delete pattern as the existing notes system. Any show member can add notes during or after a meeting.

### Liveblocks Room (one per show, always-on)

```ts
type Storage = {
  presenter_id: string | null
  presenter_request: { from_user_id: string; requested_at: number } | null
  active_meeting_id: string | null      // ties room to a Supabase meeting record
  active_material_ids: string[]         // materials on the light table (max 4); length === panel_sizes.length
  panel_sizes: number[]                 // panel widths in %, must sum to 100, e.g. [60, 40]
  filters: {
    department_ids: string[]
    tags: string[]
    states: ('exploratory' | 'proposed' | 'decided')[]
  }
}

type Presence = {
  user_id: string
  current_material_id: string | null
  mode: 'browse' | 'follow'
}

type BroadcastEvent =
  | { type: 'navigate'; material_id: string }
```

`active_material_ids`, `panel_sizes`, and `filters` are presenter-controlled in follow mode. Browse-mode members maintain their own local copies of all three.

---

## Meeting Lifecycle

### Creating a meeting
- Only members with `can_manage_show` permission may create meetings.
- Form fields: title + scheduled date/time.
- Inserts a `meetings` row with `started_at = null` and `ended_at = null`.
- Meeting appears in a list on the show page.

### Joining a meeting
- Member opens the meeting → joins the Liveblocks room.
- If `started_at` is null and this is the first member to join → Server Action sets `started_at = now()` and writes `active_meeting_id` to Liveblocks storage.
- Join prompt: **"Join as viewer (follow presenter)"** or **"Browse freely"** → sets `presence.mode`.

### Presenter handoff

**Claiming when no presenter:**
Any member may claim presenter directly — writes their `user_id` to `storage.presenter_id` immediately. No request needed.

**Requesting when a presenter exists:**
1. Member clicks "Request presenter" → writes `{ from_user_id, requested_at }` to `storage.presenter_request`.
2. Current presenter sees a toast: "X wants to present — Yield / Decline."
3. **Yield:** clears `presenter_request`, sets `presenter_id` to requester.
4. **Decline:** clears `presenter_request`.
5. **Timeout:** if no response in 30 seconds, the requester's client clears `presenter_request` and shows "Request timed out." No server involvement.
6. Only one request may exist at a time. "Request presenter" button is disabled while a request is pending.

**Releasing presenter voluntarily:**
Presenter clicks "Release" → clears `presenter_id` from storage.

### Presenter disconnect
- Liveblocks detects presence loss → the oldest remaining connected member (lowest `joinedAt` timestamp in presence) performs the cleanup write: clears `presenter_id` (and `presenter_request` if the disconnected user was the requester) from storage. Using a single designated writer prevents concurrent conflicting writes.
- Toast to all members: **"[Name] left — presenter role is open."**
- Light table state (`active_material_ids`, `panel_sizes`, `filters`) is preserved.
- Any member may now claim presenter directly.

### Ending a meeting
- Any member with `can_manage_show` may end the meeting.
- Server Action: sets `ended_at = now()` on the `meetings` row, clears `active_meeting_id` from Liveblocks storage.
- All clients detect `active_meeting_id = null` and show: "Meeting ended by [name]."
- Room stays open; members remain in browse mode with live presence but no active meeting record.

---

## UI Layout

### Overall structure

Layout C: fullscreen light table with a bottom strip. Maximum screen real estate for material viewing.

```
┌─────────────────────────────────────────────────┐
│ Top bar: show name · meeting title · Live badge │ (end meeting control)
├─────────────────────────────────────────────────┤
│                                                 │
│              Light Table                        │
│         (1–4 resizable panels)                  │
│                                                 │
├─────────────────────────────────────────────────┤
│ Filmstrip │ │ Avatars │ │ Filter │ Presenter ctl │ Notes ↑ │
└─────────────────────────────────────────────────┘
```

### Light table
- Displays 1–4 materials simultaneously.
- Auto-grid layout: 1 → full width; 2 → side-by-side; 3 → 2 + 1 stacked; 4 → 2×2.
- Panels are resizable via drag handles.
- In follow mode, the presenter's `active_material_ids`, `panel_sizes`, and `filters` are mirrored to all followers in real time.
- In browse mode, each member controls their own light table independently. Their material selection, panel sizes, and filters are local React state only — not written to Liveblocks storage.

### Filmstrip
- Scrollable horizontal strip of material thumbnails.
- Filtered by the active filter set (department, tag, annealing state).
- Click a thumbnail to add it to the light table; click again to remove it. Max 4.
- Selected thumbnails show a blue ring.
- In follow mode, the filmstrip reflects the presenter's filter and selection.

### Filter controls
- Three filter axes: department, tag, annealing state.
- Tags support arbitrary values (e.g., "act I", "dark palette") enabling cross-department groupings.
- Presenter's active filters sync to followers in follow mode.

### Presence avatars
- Initials avatar per connected member, green ring = presenter, blue = others.
- Clicking an avatar shows their name and current mode (browse/follow).

### Presenter controls
- **No presenter:** "Claim presenter" button.
- **You are presenter:** "Release" button.
- **Someone else is presenter:** "Request presenter" button (disabled while a request is pending).
- In follow mode: a banner "Following [Name] — Browse freely" with a link to exit follow mode.

### Notes drawer
- Collapsed by default; "Notes ↑" button in bottom strip expands it.
- Any show member may add notes during or after the meeting.
- Soft-delete (hide/restore) matches the existing notes pattern.

### Keyboard shortcuts
- `←` / `→` — navigate filmstrip (move selection by one).
- `Escape` — exit follow mode, enter browse mode.

---

## Component Breakdown

| Component | Responsibility |
| --- | --- |
| `MeetingListPage` | Show's meeting list; create meeting form (gated on `can_manage_show`) |
| `MeetingRoom` | Root meeting view; joins Liveblocks room, renders layout |
| `JoinPrompt` | Modal: "viewer" vs "browse freely" on entry |
| `LightTable` | Renders 1–4 material panels in auto-grid with resize handles |
| `MaterialPanel` | Single material viewer (image, file, link, or note) |
| `Filmstrip` | Horizontal scrollable thumbnail strip with filter controls |
| `PresenceBar` | Avatar row in bottom strip |
| `PresenterControls` | Claim / request / release presenter logic |
| `FollowBanner` | "Following X — Browse freely" bar shown to followers |
| `PresenterRequestToast` | Toast shown to current presenter on incoming request |
| `NotesDrawer` | Collapsible notes panel; add/hide/restore notes |
| `EndMeetingButton` | Visible only to `can_manage_show`; triggers Server Action |

---

## Server Actions

| Action | Permission | Effect |
| --- | --- | --- |
| `createMeeting(showId, title, scheduledAt)` | `can_manage_show` | Insert `meetings` row |
| `startMeeting(meetingId)` | Any show member | Set `started_at`, write `active_meeting_id` to Liveblocks |
| `endMeeting(meetingId)` | `can_manage_show` | Set `ended_at`, clear `active_meeting_id` from Liveblocks |
| `addMeetingNote(meetingId, body)` | Any show member | Insert `meeting_notes` row |
| `hideMeetingNote(noteId)` | Any show member | Set `hidden_at = now()` |
| `restoreMeetingNote(noteId)` | Any show member | Set `hidden_at = null` |

---

## Error Handling

| Scenario | Behavior |
| --- | --- |
| Presenter disconnects | `presenter_id` cleared; toast "Presenter role is open"; anyone can claim |
| Presenter request timeout (30s) | Requester's client clears `presenter_request`; shows "Request timed out" |
| Concurrent presenter requests | Only one `presenter_request` at a time; button disabled while pending |
| Meeting ended mid-session | All clients detect null `active_meeting_id`; banner "Meeting ended by [name]" |
| Network reconnect | Liveblocks handles automatically; member re-enters their last `presence.mode` |

---

## Testing

### Unit tests (Vitest)
- Liveblocks storage mutation helpers: `claimPresenter`, `requestPresenter`, `yieldPresenter`, `clearPresenterRequest`, `setFilters`, `setActiveMaterials`, `setPanelSizes`
- Filter logic: given a material list + filter set → correct subset returned
- Auto-grid layout: given `n` materials (1–4) → correct panel count and default sizes

### Integration tests (Vitest + Testing Library)
- Join prompt: "viewer" → `presence.mode = 'follow'`; "browse freely" → `presence.mode = 'browse'`
- Filmstrip: click thumbnail adds to `active_material_ids`; 5th click rejected (max 4)
- Presenter request flow: request → pending state → yield → `presenter_id` updated
- "End meeting" only visible to `can_manage_show` members; triggers correct Server Action
- Notes: add, hide, restore all update DB correctly

### Not tested in v1
- Real-time sync across multiple live browser tabs (manual QA only)
- WebSocket reconnection (Liveblocks' responsibility)

### Liveblocks mocking
- `@liveblocks/jest-matchers` + mock room factory for unit tests
- Liveblocks test client utilities for integration tests

---

## RLS Notes

- `meetings` and `meeting_notes` rows are readable only by show members (enforced via Supabase RLS, same pattern as existing tables).
- `createMeeting` and `endMeeting` Server Actions verify `can_manage_show` before writing.
- `startMeeting` is callable by any show member (first-joiner pattern).
