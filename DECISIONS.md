# Architecture Decision Records

Decisions are append-only. To reverse a decision, add a new entry superseding the old one.

---

## ADR-001: Next.js as Application Framework

**Date:** 2026-05-07
**Status:** Accepted (updated 2026-05-07: using Next.js 16.2.6, not 14 — `create-next-app@latest` resolved to 16; App Router patterns are identical)

**Decision:** Use Next.js 14 with App Router as the front-end framework.

**Alternatives considered:**
- Remix — strong TypeScript, full-stack, but smaller training corpus
- SvelteKit — excellent DX, but less Claude Code training data
- Nuxt (Vue) — weaker TypeScript story

**Rationale:**
Largest training data corpus of any full-stack framework, making it the strongest choice for AI-assisted development. App Router provides Server Components (no API layer for reads), Server Actions (secure Claude API calls), and native streaming for agent output.

---

## ADR-002: Liveblocks for Real-Time Collaboration

**Date:** 2026-05-07
**Status:** Accepted

**Decision:** Use Liveblocks for real-time presence, shared state, and "follow the leader" meeting mode.

**Alternatives considered:**
- PartyKit — more control, but requires building sync logic from scratch
- Supabase Realtime — one fewer vendor, but not purpose-built for collaborative UI patterns

**Rationale:**
Real-time sync was identified as the highest-priority technical risk. Liveblocks provides purpose-built primitives (presence, storage, broadcast) that directly map to the app's needs. Last-write-wins conflict resolution handles the "anyone can grab control" requirement cleanly. Defers the hardest problem so learning can focus on auth/permissions and agents.

---

## ADR-003: Supabase for Auth, Database, and Storage

**Date:** 2026-05-07
**Status:** Accepted

**Decision:** Use Supabase for authentication, Postgres database, Row Level Security, and file storage.

**Rationale:**
Single vendor for three concerns reduces operational complexity. Row Level Security enforces org data isolation at the database level — a hard security requirement. Generous free tier fits the university/regional theater target audience. Magic link auth reduces friction for non-technical users.

---

## ADR-004: Web-Only Deployment Target

**Date:** 2026-05-07
**Status:** Accepted

**Decision:** Build for web browsers only. No native mobile app.

**Rationale:**
Target audience (universities, regional theaters) primarily uses laptops and shared computers. Mobile browser handles on-site tablet use cases adequately. Native mobile would double the build/maintenance surface without sufficient justification for this audience.

---

## ADR-005: Claude as Optional Progressive Enhancement

**Date:** 2026-05-07
**Status:** Accepted

**Decision:** Claude AI features are optional, toggled per org via `settings.claude_enabled`. The app must be fully functional without Claude.

**Rationale:**
There is an industry bias against AI in the arts. Orgs must be able to use the app entirely manually. Claude handles infrastructure concerns only (tagging, search, summarization) — never creative decisions. This also allows orgs with cost or policy constraints to opt out.

---

## ADR-006: Single-Turn Agents in Phase 1

**Date:** 2026-05-07
**Status:** Accepted

**Decision:** Phase 1 agent orchestration uses single-turn tool calls only. No multi-step reasoning, no agent-to-agent communication.

**Rationale:**
The project is a learning exercise in agent orchestration. Starting with the simplest pattern (single-turn) allows the architecture to be understood before adding complexity. The system is designed to grow toward chained agents in later phases.

---

## ADR-007: Annealing Model for Material Lifecycle

**Date:** 2026-05-07
**Status:** Accepted

**Decision:** Materials move through three states: `exploratory → proposed → decided`. Transition rules are configurable per show.

**Rationale:**
Theatrical design process mirrors annealing — chaotic inputs at the start coalesce into firm decisions. The three-state model captures this without imposing rigid workflow on early-stage work. Per-show configuration (`single` vs `multi` approval, `allow_reopen`) accommodates the wide variety of working styles across organizations.

---

## ADR-008: Last-Write-Wins for Presenter Control

**Date:** 2026-05-07
**Status:** Accepted

**Decision:** Any member can claim presenter control at any time. Conflicts resolved by last write wins via Liveblocks Storage.

**Rationale:**
Theater culture is collaborative and informal. Requiring negotiation or permission to take the wheel would create friction. Last-write-wins is simple, predictable, and matches the expectation that "whoever clicks Take Control" drives.

---

## ADR-009: No Audio/Video

**Date:** 2026-05-07
**Status:** Accepted

**Decision:** The app provides no audio or video conferencing. Users run their own meeting tools alongside Techne.

**Rationale:**
Conferencing is a solved problem (Zoom, Meet, phone). Building it would add significant complexity with no competitive advantage. Keeping Techne focused on design material collaboration makes it a better companion tool rather than a worse conferencing tool.

---

## ADR-010: Flexible Roles — No Hardcoded Role Types

**Date:** 2026-05-07
**Status:** Accepted

**Decision:** Role names and permission sets are defined per org, with optional overrides per show. No role types are hardcoded in the application.

**Rationale:**
There is no standard organizational structure in theater. A university production, a LORT theater, a community theater, and a commercial production all have different role names and hierarchies. Hardcoding roles would exclude the majority of potential users.
