# Learnings

Orchestration patterns and lessons discovered during development.

---

## Next.js Route Groups Don't Add URL Segments

**Discovered:** 2026-05-07 — Plan 1 smoke test

Route groups like `app/(auth)/callback/route.ts` resolve to `/callback`, not `/auth/callback`. Any route that must exist at a specific URL (e.g. an OAuth callback registered with an external service) must use a real directory, not a route group.

**Pattern:** Use route groups for layout organization only. Use real directories for URL-significant paths.

---

## Supabase CLI Requires .env as a File, Not a Directory

**Discovered:** 2026-05-07 — Plan 1 Task 2

The Supabase CLI reads `.env` as a file for project configuration. If `.env` is a directory (e.g. `.env/.local`), CLI commands fail. Workaround: symlink `.env.local → .env/.local` for Next.js, use `--project-ref` flag explicitly for CLI commands.

---

## Supabase Does Not Allow Modifying auth.users Directly

**Discovered:** 2026-05-07 — Plan 1 Task 2

Hosted Supabase projects do not grant ownership of the `auth` schema. Columns cannot be added to `auth.users` via migrations. The standard pattern is a separate `public.profiles` table with a 1:1 relationship to `auth.users`, populated via a trigger on user creation.

**Implication for Plan 2:** `display_name` and other user profile fields must live in a `profiles` table.
