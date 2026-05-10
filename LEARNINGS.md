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

---

## RLS UPDATE `with check` Conflicts with Partial-Update Operations

**Discovered:** 2026-05-09 — Plan 4 Task 5/6

Adding `updated_by = auth.uid()` to the UPDATE policy's `with check` to prevent impersonation seemed safe — `updateNote` always sets `updated_by = user.id`. But the same policy governs `hideNote`/`restoreNote`, which intentionally omit `updated_by`. Postgres `with check` evaluates the *resulting row*, not the columns being written. So if user-2 hides user-1's note, the check `updated_by = auth.uid()` sees `updated_by = 'user-1' ≠ auth.uid()` and rejects the update — even though `updated_by` wasn't touched.

**Pattern:** When a table has operations with different column update semantics (full content edit vs. flag toggle), the RLS UPDATE policy cannot use field-value constraints that only apply to one operation type. Enforce those constraints at the application layer instead.
