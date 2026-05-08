# Requirements Design

**Date:** 2026-05-07
**Topic:** Product requirements for Techne — theatrical designers collaboration app

---

## Vision

Techne is a design-phase collaboration platform for theatrical teams. Its north star is enabling productive live design meetings — a single session where the team navigates materials together should demonstrate the app's value immediately.

**Target audience:** Universities and smaller regional theaters. Budget-conscious, mixed technical skill levels, prone to workflow inertia (Google Drive, email, Dropbox).

**Adoption risk (priority order):**

1. Cost — even a small fee is a barrier for university and regional programs
2. Behavioral change — designers have existing workflows
3. Technical friction — setup and login must be frictionless
4. Trust — who can see my work

**Scope:** Design phase of a production only. Not a production execution or run-of-show tool.

---

## Users

| User | Description |
| --- | --- |
| Techne Admin | Platform operator (single admin in v1). Approves org creation requests. |
| Org Admin | Manages members, roles, seasons, shows, and org settings (including Claude toggle). |
| Org Member (with `can_manage_show`) | Can create shows and add members. |
| Show Member | Uploads materials, participates in meetings, adds notes. |

---

## Org & Access Management

### Org Lifecycle

- Orgs are created by request and approved by a Techne admin — no self-service creation
- Each org represents a theater company or university theater program

### User Accounts

- One account per person across all orgs (single login, org switcher)
- Orgs are fully isolated — no cross-org data visibility

### Joining an Org

- Org admin invites users by email, OR users request to join and admin approves
- No open join links, no public org discovery
- Default to controlled access — err toward restriction

### Show Creation & Membership

- Org admin or any member with `can_manage_show` permission can create shows
- Members are added incrementally — shows start with few members and grow over time
- Show lifecycle states: pre-production, in-production, closed — informational only, no behavioral restrictions

### Roles

- Role names and permission sets are defined per org, optionally overridden per show
- Show-level role definition wins on name collision with org-level
- No hardcoded role types — every org defines their own

**Permission flags:**

| Flag | Controls |
| --- | --- |
| `can_approve` | Move materials to `decided` state |
| `can_upload` | Upload materials and add notes |
| `can_manage_members` | Add/remove show members, assign roles |
| `can_manage_show` | Create shows, edit show settings |

---

## Materials

### Types

- `image` — renderings, sketches, photos, mood board images
- `file` — PDFs, plots, documents
- `link` — external URLs with server-side thumbnail preview
- `note` — inline text content (not a file attachment)

### Metadata

**Core (all materials):**

| Field | Description |
| --- | --- |
| `title` | Name of the material |
| `department` | Design discipline (e.g., Lighting, Scenic, Costume) |
| `description` | Free-text description or caption |
| `phase` | Production phase: concept, design presentation, paper tech, tech rehearsal, preview, opening |
| `tags` | Free-form tags; Claude-assisted when org has Claude enabled |
| `version` | Revision indicator (e.g., v1, v2, final) |

**Contextual (optional — shown by department or material type):**

| Field | Relevant to |
| --- | --- |
| `character` | Costume, hair/makeup, props |
| `act` | Any script-referenced material |
| `scene` | Any script-referenced material |
| `source` | Vendor, artist, inspiration reference, or "original" |

### Lifecycle (Annealing Model)

```text
exploratory  →  proposed  →  decided
                              ↓ (if show.allow_reopen = true)
                           proposed
```

- `exploratory → proposed` — any show member
- `proposed → decided` — follows show's `approval_mode`
  - `single`: any member with `can_approve` approves
  - `multi`: all roles in `show.approval_roles[]` must sign off
- `decided → proposed` — only if `show.allow_reopen = true`

### Search

- Full-text search across title and description, combined with filters
- Filters: department, phase, state, tags, material type
- Search is scoped at show, season, or org level

---

## Meetings

- Any show member can start a live meeting session — no special permission required
- Two navigation modes:
  - **Browse** — members navigate independently, see each other's presence
  - **Presentation** — any member claims presenter role; all clients follow their navigation
- Presenter control: last-write-wins, any member can claim at any time
- No audio/video — users run their own conferencing tools alongside Techne
- Meeting sessions are persisted: timestamp, attendee list, meeting notes

---

## Notes

- Three levels: material-level, show-level, meeting-level
- Any member with `can_upload` permission can add notes
- Notes are persistent — not ephemeral chat
- Notes are not subject to the material approval workflow
- Threaded discussions are out of scope for v1

---

## Agent Features (Optional per Org)

All Claude features are toggled per org via `settings.claude_enabled`. The app is fully functional without them.

| Agent | Trigger | Behavior |
| --- | --- | --- |
| Tagging | Material upload | Suggests tags based on material content and show context |
| Search | User query | Keyword + metadata search; Claude summarizes results |
| Summary | User request | Plain-text "where we've landed" summary per department |

---

## Out of Scope — v1

The following are explicitly excluded to keep v1 focused:

- Production execution tools (cue lists, run-of-show, calling scripts)
- Calendar/scheduling integration
- Budget or cost tracking
- Threaded discussions on notes
- Email/push notifications
- Export or PDF design packets
- Script import (Final Draft, etc.)
- Native mobile app
- Public portfolio or show pages
- Billing/subscription management (orgs are admin-provisioned)

---

## Success Criteria

A university theater department uses Techne for one full production and conducts at least one productive live design meeting using the app's presentation mode.
