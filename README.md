# Techne

A collaboration platform for theatrical design teams. Designers upload images, files, links, and notes to shared department workspaces. Materials move through an annealing lifecycle (exploratory → proposed → decided) so the team converges on decisions over time.

## Setup

**Prerequisites:** Node.js 20+, [Supabase CLI](https://supabase.com/docs/guides/cli)

```bash
npm install
cp .env.local.example .env.local   # then fill in your Supabase credentials
supabase start                      # starts local Postgres + Auth + Storage
supabase db reset                   # applies migrations and seeds test data
npm run dev                         # http://localhost:3000
```

### Environment variables

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable key |
| `SUPABASE_SECRET_KEY` | Service role key (server-side only) |

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm test` | Run test suite (Vitest) |
| `npm run test:watch` | Watch mode |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

## Key documents

| Document | Purpose |
|---|---|
| [REQUIREMENTS.md](REQUIREMENTS.md) | Product requirements |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System architecture and data model |
| [PLAN.md](PLAN.md) | Feature roadmap and plan status |
| [DECISIONS.md](DECISIONS.md) | Architecture decision records (ADRs) |
| [GLOSSARY.md](GLOSSARY.md) | Theatrical domain terms used in code |
| [LEARNINGS.md](LEARNINGS.md) | Agent orchestration patterns discovered |
| [docs/specs/](docs/specs/) | Detailed feature specs |
| [docs/plans/](docs/plans/) | Implementation plans |
