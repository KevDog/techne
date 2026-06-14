# Tech Stack & Agent Assignments

## Stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16.2.6 (App Router) |
| Real-time | Liveblocks |
| Auth + DB + Storage | Supabase |
| AI agents | Claude API (via Server Actions) |
| Styling | Tailwind CSS v4 |
| UI Components | Tailwind Plus (500+ blocks, React + Headless UI) |
| Testing | Vitest + Testing Library |

## Agent Assignments

- **All implementation work** (frontend, backend, tests) → `builder` agent via `/build-loop`
- **Agent orchestration features** → use `claude-api` skill

## Design Spec

See `docs/specs/2026-05-07-framework-selection-design.md` for full architectural decisions and rationale.
