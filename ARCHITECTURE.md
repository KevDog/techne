# Architecture

> Full decision rationale: `docs/superpowers/specs/2026-05-07-framework-selection-design.md`

---

## System Overview

A web-based collaboration platform for theatrical design teams. Two modes of use:

- **Async** — curate and organize design materials (images, renderings, links, notes)
- **Live meeting** — "follow the leader" navigation through materials during design meetings

No audio/video. Users run their own meeting tools (Zoom, Meet, etc.) alongside this app.

---

## Stack

| Layer | Technology | Why |
| --- | --- | --- |
| Framework | Next.js 14 (App Router) | TypeScript-first, Server Components, Server Actions, streaming |
| Real-time | Liveblocks | Purpose-built presence + shared state; handles conflict resolution |
| Auth + DB + Storage | Supabase | Postgres + RLS, file storage, auth, generous free tier |
| AI agents | Claude API (Server Actions only) | Keys never leave server; streaming built in; optional per org |
| Styling | Tailwind CSS | |
| Testing | Vitest + Testing Library | |

---

## High-Level Architecture

```text
Browser (Next.js App Router)
    │
    ├── Liveblocks ◄──── real-time presence, "follow the leader", shared state
    │
    ├── Next.js Server Actions
    │       ├── Supabase (Postgres + Auth + Storage)
    │       └── Claude API (optional — tagging, search, summary agents)
    │
    └── Supabase Auth (JWT) ◄──── session management
```

- Server Components fetch data directly — no separate API layer for reads
- Server Actions are the only path to Claude — API keys never reach the browser
- Liveblocks handles all live session state — Supabase holds the permanent record

---

## Data Hierarchy

```text
Organization
    ├── settings: { claude_enabled: boolean }
    ├── role_definitions: [{ name, permissions[] }]      ← org defaults
    └── Seasons[]
            └── Shows[]
                    ├── approval_mode: "single" | "multi"
                    ├── approval_roles: role_definition_id[]
                    ├── allow_reopen: boolean
                    ├── role_definitions: [{ name, permissions[] }]  ← show overrides
                    ├── members: [{ user_id, role_definition_id }]
                    ├── notes: Note[]
                    ├── meetings: Meeting[]
                    └── Departments[]
                                └── Materials[]
                                            └── notes: Note[]
```

---

## Flexible Roles

Roles are never hardcoded. Each org defines its own role names and permission flags:

```text
can_approve | can_upload | can_manage_members | can_manage_show | ...
```

Shows inherit org role definitions and may override or extend them. Show-level wins on name collision. Members are assigned a role from the merged set.

---

## Material Lifecycle (Annealing Model)

Materials move from chaotic inputs toward firm decisions:

```text
exploratory  →  proposed  →  decided
                              ↓ (if allow_reopen)
                           proposed
```

- `exploratory → proposed` — any member
- `proposed → decided` — follows show's `approval_mode` (`single` or `multi`)
- `decided → proposed` — only if `show.allow_reopen = true`

---

## Real-Time Meeting Mode

```text
Liveblocks Room (one per Show)
    ├── presence:  { user_id, cursor, current_material_id }
    ├── storage:   { presenter_id: string | null }
    └── broadcast: { type: "navigate", material_id }
```

- **Browse mode** (default) — independent navigation, shared presence
- **Presentation mode** — any user claims `presenter_id`; all clients follow
- Control is last-write-wins — no negotiation, no deadlock
- Meeting sessions are persisted in Supabase (timestamp, attendees, notes)

---

## Notes

Notes exist at three levels, all stored in Supabase:

| Level | Attached to | Visible to |
| --- | --- | --- |
| Material | A specific uploaded material | All show members |
| Show | The show generally | All show members |
| Meeting | A specific meeting record | All show members |

Notes are not subject to the material approval workflow.

---

## Agent Orchestration

Claude is a progressive enhancement — the app is fully functional without it.

| Agent | Trigger | Action |
| --- | --- | --- |
| Tagging | Material upload | Suggests tags from material + show context |
| Search | User query | Keyword + metadata search; Claude summarizes results |
| Summary | User request | "Where we've landed" summary per department |

**Phase 1 pattern:** Single-turn tool calls via Server Actions. No multi-step reasoning, no agent-to-agent communication. Designed to grow toward chained agents in later phases.

When `org.settings.claude_enabled = false`: all agent UI entry points are hidden. No dead code paths.

---

## Security Model

- Supabase Row Level Security enforces org isolation at the database level
- Users can only read data from orgs they belong to — enforced even if application code has bugs
- Claude API keys live only in server environment variables — never sent to browser
- Auth via Supabase magic link (email) + JWT session cookies managed by SSR helpers

---

## Implementation Plans

| Plan | Subsystem | File |
| --- | --- | --- |
| 1 | Scaffold + Auth | `docs/plans/2026-05-07-plan-1-scaffold-auth.md` |
| 2 | Data hierarchy + Flexible roles | TBD |
| 3 | Materials + Annealing workflow | TBD |
| 4 | Notes system | TBD |
| 5 | Real-time meeting mode | TBD |
| 6 | Agent orchestration | TBD |

Plans 3, 4, and 5 are independent — candidates for parallel execution.
