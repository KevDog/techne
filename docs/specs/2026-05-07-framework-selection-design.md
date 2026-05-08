# Framework Selection Design

**Date:** 2026-05-07
**Topic:** Front-end framework and core technical stack for theatrical designers collaboration app

---

## Context

A web-based collaboration platform for theatrical design teams at universities and smaller regional theaters. Supports async material curation and real-time "follow the leader" navigation during design meetings. No audio/video — users run their own meeting tools alongside this app.

Target users: directors, designers (lighting, scenic, sound, costumes, etc.), producers. Roles are fully flexible — no hardcoded role types.

---

## Selected Stack

| Layer | Technology | Reason |
| --- | --- | --- |
| Framework | Next.js (App Router) | Largest training corpus, TypeScript-first, Server Actions for secure Claude calls, streaming built in |
| Real-time | Liveblocks | Purpose-built for "follow the leader" presence/state sync, handles conflict resolution |
| Auth + DB + Storage | Supabase | Postgres + Row Level Security for flexible permissions, file storage, generous free tier |
| AI agents | Claude API (via Server Actions) | Optional per org, never exposes keys to browser |

---

## Architecture Overview

```text
Browser (Next.js App Router)
    │
    ├── Liveblocks ◄──── real-time presence, "follow the leader", shared state
    │
    ├── Next.js API Routes / Server Actions
    │       ├── Supabase (Postgres + Auth + Storage)
    │       └── Claude API (agent features — search, tagging, summarization)
    │
    └── Supabase Auth (JWT) ◄──── session management
```

Server Components handle data fetching without an API layer. Server Actions are the secure bridge to Claude. Streaming responses for agent output are built in.

---

## Data Hierarchy & Flexible Roles

```text
Organization
    ├── settings: { claude_enabled: boolean }
    ├── role_definitions: [{ name, permissions[] }]   ← org defaults
    └── Seasons[]
            └── Shows[]
                    ├── approval_mode: "single" | "multi"
                    ├── approval_roles: role_definition_id[]  ← required signatories for "multi" mode
                    ├── allow_reopen: boolean  ← can decided materials be moved back to proposed
                    ├── role_definitions: [{ name, permissions[] }]  ← show overrides/additions
                    ├── members: [{ user_id, role_definition_id }]
                    ├── notes: Note[]  ← general show-level notes
                    ├── meetings: Meeting[]
                    └── Departments[]
                                └── Materials[]
                                            └── notes: Note[]  ← per-material notes
```

**Flexible roles:** No role types are hardcoded. Each org defines their own roles with permission flags (`can_approve`, `can_upload`, `can_manage_members`, etc.). Shows can override or extend org-level role definitions — show-level wins on name collision.

**Approval modes per show:**

- `single` — any member marks material as decided
- `multi` — requires sign-off from roles listed in `show.approval_roles[]`

**RLS:** Supabase Row Level Security enforces org isolation at the database level.

---

## Notes

Notes exist at three levels:

- **Material notes** — attached to a specific uploaded material; visible to all show members
- **Show notes** — general notes not tied to any material; visible to all show members
- **Meeting notes** — production notes captured during or after a meeting; attached to a specific meeting record

```text
Note
    ├── id, author_id, created_at, updated_at
    ├── body: string  ← rich text
    ├── context: { type: "material" | "show" | "meeting", ref_id }
    └── pinned: boolean
```

Notes are persistent (stored in Supabase), not ephemeral. Any member with `can_upload` permission can add notes. Notes are not subject to the material approval workflow.

---

## Real-Time Meeting Mode

```text
Liveblocks Room (one per Show)
    ├── presence: { user_id, cursor, current_material_id }
    ├── storage: { presenter_id: string | null }
    └── broadcast: { type: "navigate", material_id }
```

**Two modes:**

- **Browse** (default) — users navigate independently, see others' presence
- **Presentation** — any user claims `presenter_id`; all clients lock to presenter's view

Claiming control is a last-write-wins Liveblocks Storage write. No server round-trip. No audio/video — users use external meeting tools.

**Meeting records:** Each meeting session is persisted in Supabase with a timestamp, attendee list, and associated meeting notes. Liveblocks handles the live session; Supabase holds the permanent record.

---

## Materials & the Annealing Model

```text
Material
    ├── id, show_id, department_id
    ├── type: "image" | "link" | "note" | "file"
    ├── content: { url, thumbnail, caption, metadata }
    ├── state: "exploratory" | "proposed" | "decided"
    ├── approvals: [{ user_id, role_definition_id, timestamp }]
    └── tags: string[]
```

**State transitions:**

- `exploratory → proposed` — any member
- `proposed → decided` — follows show's `approval_mode`
- `decided → proposed` — only if `show.allow_reopen` is true

File storage via Supabase Storage. Links stored as URLs with server-side thumbnail fetch at upload time.

---

## Agent Orchestration (Optional per Org)

Three single-turn agents, all via Next.js Server Actions:

| Agent | Trigger | Action |
| --- | --- | --- |
| Tagging | Material upload | Suggests tags from material type + show context |
| Search | User query | Keyword + metadata search across show materials; Claude summarizes results |
| Summary | User request | Plain-text "where we've landed" per department |

**Pattern:** Single-turn tool calls — no multi-step reasoning, no agent-to-agent communication in phase 1. Designed to grow toward chained agents in later phases.

**When Claude is disabled:** Agent UI entry points are hidden. No silent failures, no dead code paths.

---

## Key Constraints

- App must be fully functional without Claude enabled
- Roles are never hardcoded — flexibility is a first-class requirement
- No audio/video
- Target audience: universities and smaller regional theaters (budget-conscious, mixed technical skill)
- Deliberate learning pace — agent orchestration complexity increases incrementally
