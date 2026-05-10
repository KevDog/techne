# Playwright E2E Testing — Design Spec

## Overview

Add Playwright to cover navigable user flows that unit tests cannot: auth, meeting list, meeting join, notes, and end-meeting. Real-time Liveblocks sync is explicitly excluded and remains manual QA.

---

## Decisions

| Question | Decision | Rationale |
| --- | --- | --- |
| Auth strategy | Programmatic (fixture) + one UI login test | Fast test execution; auth flow still covered |
| Liveblocks sync | Not covered by Playwright | Hard to make reliable in CI; mutation logic is unit-tested |
| Test database | Fixed test org in dev Supabase project | Simple; no teardown needed at this stage |
| Test structure | Flat spec files with shared fixture | Right size for current suite; POM deferred |

---

## File Structure

```
e2e/
  fixtures/
    auth.ts          # authedPage fixture — programmatic Supabase login
  auth.spec.ts       # UI login flows
  meetings.spec.ts   # Meeting list, create, join, notes, end meeting
playwright.config.ts
.env.test            # Test credentials (gitignored)
```

---

## Configuration

**`playwright.config.ts`**
- `baseURL`: `http://localhost:3000`
- `webServer`: runs `npm run dev`, waits for `http://localhost:3000`
- Projects: `chromium` (required), `firefox` (optional)
- `testDir`: `e2e/`
- `retries`: 1 in CI, 0 locally

**`.env.test`** (gitignored, add to `.env.test.example`)
```
TEST_USER_EMAIL=...
TEST_USER_PASSWORD=...
TEST_MANAGER_EMAIL=...
TEST_MANAGER_PASSWORD=...
TEST_ORG_SLUG=...
TEST_SHOW_SLUG=...
```

Two test users required:
- **viewer** — show member without `can_manage_show`
- **manager** — show member with `can_manage_show`

Both users and their org/show must be created manually in the dev Supabase project once and left in place.

---

## Auth Fixture

**`e2e/fixtures/auth.ts`**

Exports two fixtures built on `@playwright/test`:

- `authedPage` — signs in the viewer account via `@supabase/supabase-js` (`signInWithPassword`), injects the resulting session cookies into a fresh browser context, returns the page. Used by all non-auth specs.
- `managerPage` — same pattern, uses manager credentials.

Both fixtures close their context after the test.

---

## Test Coverage

### `e2e/auth.spec.ts`

Uses the base (unauthenticated) `page` fixture.

| Test | Assertion |
| --- | --- |
| Valid login | Redirects away from `/login` to dashboard |
| Invalid credentials | Error message visible on `/login` |

### `e2e/meetings.spec.ts`

Uses `authedPage` (viewer) and `managerPage` fixtures. Navigates to `TEST_ORG_SLUG/shows/TEST_SHOW_SLUG/meetings`.

| Test | User | Assertion |
| --- | --- | --- |
| Meeting list loads | viewer | Page title contains show name; meetings list visible |
| Schedule form hidden from viewer | viewer | Form not in DOM |
| Schedule form visible to manager | manager | Form visible |
| Create meeting | manager | Submit form → new meeting title appears in list |
| Navigate to meeting | viewer | Click meeting → URL changes to `/meetings/[id]` |
| Join prompt shown | viewer | Both "Join as viewer" and "Browse freely" buttons visible |
| Join as browse | viewer | Click "Browse freely" → prompt gone, light table area visible |
| Notes drawer collapsed | viewer | Note body not visible initially |
| Notes drawer expands | viewer | Click "Notes" → composer input visible |
| Add a note | viewer | Type + submit → note text visible in drawer |
| End Meeting hidden from viewer | viewer | "End Meeting" button not in DOM |
| End Meeting visible to manager | manager | "End Meeting" button in DOM |

---

## What Is Not Covered

These remain manual QA only:

- Real-time sync across two browser contexts (presenter/follower material mirroring)
- Panel resize propagation to followers
- Presenter handoff (request/yield/timeout flows)
- WebSocket reconnection after network drop

---

## Scripts

Add to `package.json`:

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

---

## CI Notes

The `webServer` block in `playwright.config.ts` requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, and `LIVEBLOCKS_SECRET_KEY` to be available as environment variables. The test-specific credentials (`TEST_USER_EMAIL` etc.) also need to be set.

Locally, Playwright reads `.env.test` automatically if configured via `dotenv` in `playwright.config.ts`.
