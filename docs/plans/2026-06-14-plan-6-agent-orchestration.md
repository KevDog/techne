# Plan 6: Agent Orchestration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three single-turn Claude agents — Tagging, Search, and Summary — as progressive enhancements behind `org.settings.claude_enabled`. When the flag is false, all agent UI is absent from the DOM. When true, each agent is reachable from the existing department page and show-level views via dedicated Server Actions that call the Claude API server-side only.

**Architecture:** No new DB tables are needed — `claude_enabled` already lives in `org.settings` (a `jsonb` column set in migration `20260509000000_plan_2_hierarchy.sql`, typed as `OrgSettings.claudeEnabled` in `lib/types/domain.ts`). The three agents are implemented as Server Actions in `lib/actions/agents.ts`. Each agent is a single `anthropic.messages.create()` call; the response is returned to the calling Client Component. Claude API keys live in the server environment (`ANTHROPIC_API_KEY`) and never touch the browser. UI entry points are conditionally rendered on `org.settings.claudeEnabled`.

**Phase 1 constraints (strictly enforced):**
- Single-turn calls only — no multi-step chaining
- No agent-to-agent communication
- No streaming (return complete text, not a stream)
- No new Supabase tables

**Tech Stack:** Next.js 16.2.6 App Router, Supabase, `@anthropic-ai/sdk`, Server Actions (`'use server'`), Vitest + Testing Library, TypeScript strict mode.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/types/domain.ts` | Modify | Add `AgentTagSuggestion`, `AgentSearchResult`, `AgentSummaryResult` types |
| `lib/agents/tagging.ts` | Create | Pure helper: build tagging prompt from material + show context |
| `lib/agents/search.ts` | Create | Pure helper: build search prompt from query + results |
| `lib/agents/summary.ts` | Create | Pure helper: build department summary prompt from materials |
| `lib/actions/agents.ts` | Create | Server Actions: `suggestTags`, `searchWithSummary`, `summarizeDepartment` |
| `components/agents/TagSuggestionButton.tsx` | Create | Client island: shows suggested tags after upload, lets user accept/dismiss |
| `components/agents/SearchBar.tsx` | Create | Client island: query input + result list with Claude summary |
| `components/agents/DepartmentSummaryButton.tsx` | Create | Client island: "Where we've landed" button + summary panel |
| `app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/DepartmentClient.tsx` | Modify | Add `claudeEnabled` prop; render `TagSuggestionButton` after upload and `DepartmentSummaryButton` in toolbar |
| `app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.tsx` | Modify | Pass `claudeEnabled` from `org.settings` to `DepartmentClient` |
| `app/(app)/[orgSlug]/shows/[showSlug]/page.tsx` | Modify | Add `SearchBar` to show detail header when `claudeEnabled` |
| `__tests__/lib/agents/tagging.test.ts` | Create | Unit tests for `buildTaggingPrompt` |
| `__tests__/lib/agents/search.test.ts` | Create | Unit tests for `buildSearchPrompt` |
| `__tests__/lib/agents/summary.test.ts` | Create | Unit tests for `buildSummaryPrompt` |
| `__tests__/lib/actions/agents.test.ts` | Create | Unit tests for all three Server Actions |
| `__tests__/components/agents/TagSuggestionButton.test.tsx` | Create | Component tests |
| `__tests__/components/agents/SearchBar.test.tsx` | Create | Component tests |
| `__tests__/components/agents/DepartmentSummaryButton.test.tsx` | Create | Component tests |

---

## Task 1: Install dependencies and configure env var

**Files:**
- `package.json` (modified by npm install)
- `.env.local` (add ANTHROPIC_API_KEY entry)

- [x] **Step 1: Install `@anthropic-ai/sdk`**

```bash
npm install @anthropic-ai/sdk
```

Expected: `@anthropic-ai/sdk` appears in `package.json` `dependencies` and `node_modules`.

- [x] **Step 2: Add `ANTHROPIC_API_KEY` to `.env.local`**

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get the key from the Anthropic Console. The key must never be set as a `NEXT_PUBLIC_` variable.

- [x] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install @anthropic-ai/sdk"
```

---

## Task 2: Domain types for agent responses

**Files:**
- Modify: `lib/types/domain.ts`

- [ ] **Step 1: Append agent result types to `lib/types/domain.ts`**

Append after the `MeetingNote` type at the end of the file:

```ts
// ── Agent result types ────────────────────────────────────────────────────────

export type AgentTagSuggestion = {
  tags: string[]
  rationale: string
}

export type AgentSearchHit = {
  materialId: string
  title: string
  department: string
  state: MaterialState
  snippet: string
}

export type AgentSearchResult = {
  hits: AgentSearchHit[]
  summary: string
}

export type AgentSummaryResult = {
  department: string
  summary: string
  decidedCount: number
  proposedCount: number
  exploratoryCount: number
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/types/domain.ts
git commit -m "feat: add agent result types to domain"
```

---

## Task 3: Pure prompt-builder helpers

These helpers are pure functions with no I/O — easy to test without mocking.

**Files:**
- Create: `lib/agents/tagging.ts`
- Create: `lib/agents/search.ts`
- Create: `lib/agents/summary.ts`
- Create: `__tests__/lib/agents/tagging.test.ts`
- Create: `__tests__/lib/agents/search.test.ts`
- Create: `__tests__/lib/agents/summary.test.ts`

- [ ] **Step 1: Write failing tests for `tagging.ts`**

```ts
// __tests__/lib/agents/tagging.test.ts
import { describe, it, expect } from 'vitest'
import { buildTaggingPrompt } from '@/lib/agents/tagging'
import type { Material } from '@/lib/types/domain'

const material: Material = {
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Lighting plot Act 1',
  description: 'Overview of practical and theatrical lighting positions',
  url: null,
  storagePath: 'org-1/show-1/dept-1/uuid/plot.png',
  body: null,
  tags: [],
  createdAt: '2026-06-14T00:00:00Z',
}

describe('buildTaggingPrompt', () => {
  it('includes the material title', () => {
    const prompt = buildTaggingPrompt(material, 'Hamlet', 'Lighting Design', [])
    expect(prompt).toContain('Lighting plot Act 1')
  })

  it('includes the show name', () => {
    const prompt = buildTaggingPrompt(material, 'Hamlet', 'Lighting Design', [])
    expect(prompt).toContain('Hamlet')
  })

  it('includes the department name', () => {
    const prompt = buildTaggingPrompt(material, 'Hamlet', 'Lighting Design', [])
    expect(prompt).toContain('Lighting Design')
  })

  it('includes existing tags as context when provided', () => {
    const prompt = buildTaggingPrompt(material, 'Hamlet', 'Lighting Design', ['act-1', 'practical'])
    expect(prompt).toContain('act-1')
    expect(prompt).toContain('practical')
  })

  it('includes the material type', () => {
    const prompt = buildTaggingPrompt(material, 'Hamlet', 'Lighting Design', [])
    expect(prompt).toContain('image')
  })

  it('requests JSON output', () => {
    const prompt = buildTaggingPrompt(material, 'Hamlet', 'Lighting Design', [])
    expect(prompt).toContain('JSON')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/lib/agents/tagging.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/agents/tagging.ts`**

```ts
import type { Material } from '@/lib/types/domain'

export function buildTaggingPrompt(
  material: Material,
  showName: string,
  departmentName: string,
  existingTagsAcrossDept: string[]
): string {
  const existingTagsText = existingTagsAcrossDept.length > 0
    ? `\nExisting tags used in this department (use these for consistency where appropriate): ${existingTagsAcrossDept.join(', ')}`
    : ''

  return `You are a theatrical design assistant helping tag design materials for a production.

Show: ${showName}
Department: ${departmentName}
Material title: ${material.title}
Material type: ${material.type}
${material.description ? `Description: ${material.description}` : ''}
${material.body ? `Content: ${material.body}` : ''}
${material.url ? `URL: ${material.url}` : ''}
Current state: ${material.state}${existingTagsText}

Suggest 3–6 concise tags for this material. Tags should be lowercase, hyphenated (e.g. "act-1", "warm-tones", "practical"). Focus on: act/scene reference, visual quality, technique, or design intent.

Respond with valid JSON only, in this exact shape:
{"tags": ["tag-one", "tag-two"], "rationale": "One sentence explaining the tag choices."}`
}
```

- [ ] **Step 4: Run tagging tests — expect PASS**

```bash
npx vitest run __tests__/lib/agents/tagging.test.ts
```

- [ ] **Step 5: Write failing tests for `search.ts`**

```ts
// __tests__/lib/agents/search.test.ts
import { describe, it, expect } from 'vitest'
import { buildSearchPrompt, filterMaterialsByQuery } from '@/lib/agents/search'
import type { Material } from '@/lib/types/domain'

const mat = (overrides: Partial<Material> = {}): Material => ({
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Test Material',
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-06-14T00:00:00Z',
  ...overrides,
})

describe('filterMaterialsByQuery', () => {
  it('matches title case-insensitively', () => {
    const results = filterMaterialsByQuery([mat({ title: 'Dark Palette' })], 'dark')
    expect(results).toHaveLength(1)
  })

  it('matches tags', () => {
    const results = filterMaterialsByQuery([mat({ tags: ['act-1', 'warm'] })], 'act-1')
    expect(results).toHaveLength(1)
  })

  it('matches description', () => {
    const results = filterMaterialsByQuery([mat({ description: 'gothic arches' })], 'gothic')
    expect(results).toHaveLength(1)
  })

  it('matches body text for notes', () => {
    const results = filterMaterialsByQuery([mat({ type: 'note', body: 'minimalist staging' })], 'minimalist')
    expect(results).toHaveLength(1)
  })

  it('returns empty when nothing matches', () => {
    const results = filterMaterialsByQuery([mat({ title: 'Lighting Plot' })], 'costume')
    expect(results).toHaveLength(0)
  })

  it('returns multiple matching materials', () => {
    const mats = [
      mat({ id: 'a', title: 'Act 1 Scene 1' }),
      mat({ id: 'b', title: 'Act 2 Scene 1' }),
      mat({ id: 'c', title: 'Costume sketch' }),
    ]
    const results = filterMaterialsByQuery(mats, 'Act')
    expect(results).toHaveLength(2)
  })
})

describe('buildSearchPrompt', () => {
  it('includes the user query', () => {
    const prompt = buildSearchPrompt('dark moody palette', [mat({ title: 'Dark Light Plot' })], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('dark moody palette')
  })

  it('includes material titles', () => {
    const prompt = buildSearchPrompt('dark', [mat({ title: 'Dark Light Plot' })], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('Dark Light Plot')
  })

  it('includes show and department context', () => {
    const prompt = buildSearchPrompt('warm', [mat()], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('Hamlet')
    expect(prompt).toContain('Lighting Design')
  })

  it('requests JSON output', () => {
    const prompt = buildSearchPrompt('test', [mat()], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('JSON')
  })
})
```

- [ ] **Step 6: Run to verify failure**

```bash
npx vitest run __tests__/lib/agents/search.test.ts
```

- [ ] **Step 7: Implement `lib/agents/search.ts`**

```ts
import type { Material } from '@/lib/types/domain'

export function filterMaterialsByQuery(materials: Material[], query: string): Material[] {
  const q = query.toLowerCase()
  return materials.filter((m) => {
    if (m.title.toLowerCase().includes(q)) return true
    if (m.description?.toLowerCase().includes(q)) return true
    if (m.body?.toLowerCase().includes(q)) return true
    if (m.tags.some((t) => t.toLowerCase().includes(q))) return true
    if (m.url?.toLowerCase().includes(q)) return true
    return false
  })
}

export function buildSearchPrompt(
  query: string,
  hits: Material[],
  showName: string,
  departmentName: string
): string {
  const hitsSummary = hits
    .map((m, i) =>
      `${i + 1}. [${m.state}] ${m.title} (${m.type})${m.description ? ` — ${m.description}` : ''}${m.tags.length > 0 ? ` [tags: ${m.tags.join(', ')}]` : ''}`
    )
    .join('\n')

  return `You are a theatrical design assistant helping a team find relevant design materials.

Show: ${showName}
Department: ${departmentName}
User query: "${query}"

Matching materials found (${hits.length}):
${hitsSummary}

Write a concise summary (2–4 sentences) that synthesizes what these materials reveal about the design direction related to the query. If no materials were found, say so directly.

Respond with valid JSON only:
{"summary": "Your synthesis here."}`
}
```

- [ ] **Step 8: Run search tests — expect PASS**

```bash
npx vitest run __tests__/lib/agents/search.test.ts
```

- [ ] **Step 9: Write failing tests for `summary.ts`**

```ts
// __tests__/lib/agents/summary.test.ts
import { describe, it, expect } from 'vitest'
import { buildSummaryPrompt } from '@/lib/agents/summary'
import type { Material } from '@/lib/types/domain'

const mat = (overrides: Partial<Material> = {}): Material => ({
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Test Material',
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-06-14T00:00:00Z',
  ...overrides,
})

describe('buildSummaryPrompt', () => {
  it('includes department name', () => {
    const prompt = buildSummaryPrompt([mat()], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('Lighting Design')
  })

  it('includes show name', () => {
    const prompt = buildSummaryPrompt([mat()], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('Hamlet')
  })

  it('includes decided material titles', () => {
    const prompt = buildSummaryPrompt(
      [mat({ title: 'Final Plot', state: 'decided' })],
      'Hamlet',
      'Lighting Design'
    )
    expect(prompt).toContain('Final Plot')
  })

  it('includes proposed material titles', () => {
    const prompt = buildSummaryPrompt(
      [mat({ title: 'Rough Sketch', state: 'proposed' })],
      'Hamlet',
      'Lighting Design'
    )
    expect(prompt).toContain('Rough Sketch')
  })

  it('requests JSON output', () => {
    const prompt = buildSummaryPrompt([mat()], 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('JSON')
  })

  it('counts decided vs proposed vs exploratory correctly', () => {
    const materials = [
      mat({ state: 'decided' }),
      mat({ state: 'decided' }),
      mat({ state: 'proposed' }),
      mat({ state: 'exploratory' }),
    ]
    const prompt = buildSummaryPrompt(materials, 'Hamlet', 'Lighting Design')
    expect(prompt).toContain('2')  // decided count
    expect(prompt).toContain('1')  // proposed count
  })
})
```

- [ ] **Step 10: Run to verify failure**

```bash
npx vitest run __tests__/lib/agents/summary.test.ts
```

- [ ] **Step 11: Implement `lib/agents/summary.ts`**

```ts
import type { Material } from '@/lib/types/domain'

export function buildSummaryPrompt(
  materials: Material[],
  showName: string,
  departmentName: string
): string {
  const decided = materials.filter((m) => m.state === 'decided')
  const proposed = materials.filter((m) => m.state === 'proposed')
  const exploratory = materials.filter((m) => m.state === 'exploratory')

  function formatList(items: Material[]): string {
    if (items.length === 0) return '  (none)'
    return items
      .map((m) => `  - ${m.title}${m.description ? `: ${m.description}` : ''}${m.tags.length > 0 ? ` [${m.tags.join(', ')}]` : ''}`)
      .join('\n')
  }

  return `You are a theatrical design assistant. Summarize the current design status for the ${departmentName} department of "${showName}".

Material counts: ${decided.length} decided, ${proposed.length} proposed, ${exploratory.length} exploratory.

DECIDED (locked in):
${formatList(decided)}

PROPOSED (under consideration):
${formatList(proposed)}

EXPLORATORY (early ideas):
${formatList(exploratory)}

Write a "where we've landed" summary (3–5 sentences) for the design team. Focus on decided items as the current direction, note what's still in flux, and highlight any open questions implied by the exploratory materials. Tone: concise, professional, collaborative.

Respond with valid JSON only:
{"summary": "Your summary here.", "decidedCount": ${decided.length}, "proposedCount": ${proposed.length}, "exploratoryCount": ${exploratory.length}}`
}
```

- [ ] **Step 12: Run all agent helper tests — expect PASS**

```bash
npx vitest run __tests__/lib/agents/
```

- [ ] **Step 13: Commit**

```bash
git add lib/agents/ __tests__/lib/agents/
git commit -m "feat: add pure prompt-builder helpers for tagging, search, and summary agents"
```

---

## Task 4: Server Actions — agents

**Files:**
- Create: `lib/actions/agents.ts`
- Create: `__tests__/lib/actions/agents.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// __tests__/lib/actions/agents.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Material } from '@/lib/types/domain'

// ── Mock Anthropic SDK ────────────────────────────────────────────────────────

const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
  Anthropic: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

// ── Mock Supabase ─────────────────────────────────────────────────────────────

const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } })

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: vi.fn().mockResolvedValue({
    auth: { getUser: mockGetUser },
  }),
}))

// ── Mock next/cache ───────────────────────────────────────────────────────────

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

// ── Shared material fixture ───────────────────────────────────────────────────

const material: Material = {
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Lighting Plot Act 1',
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-06-14T00:00:00Z',
}

// ── suggestTags ───────────────────────────────────────────────────────────────

describe('suggestTags', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns parsed tags and rationale from Claude response', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"tags": ["act-1", "warm"], "rationale": "Focus on act reference."}' }],
    })
    const { suggestTags } = await import('@/lib/actions/agents')
    const result = await suggestTags(material, 'Hamlet', 'Lighting Design', [])
    expect(result.tags).toEqual(['act-1', 'warm'])
    expect(result.rationale).toBe('Focus on act reference.')
  })

  it('throws Unauthorized when no user session', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const { suggestTags } = await import('@/lib/actions/agents')
    await expect(suggestTags(material, 'Hamlet', 'Lighting Design', [])).rejects.toThrow('Unauthorized')
  })

  it('returns fallback on malformed Claude JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not valid json' }],
    })
    const { suggestTags } = await import('@/lib/actions/agents')
    const result = await suggestTags(material, 'Hamlet', 'Lighting Design', [])
    expect(result.tags).toEqual([])
    expect(typeof result.rationale).toBe('string')
  })
})

// ── searchWithSummary ─────────────────────────────────────────────────────────

describe('searchWithSummary', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns hits and Claude summary', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"summary": "The team favors warm practicals."}' }],
    })
    const { searchWithSummary } = await import('@/lib/actions/agents')
    const result = await searchWithSummary(
      'warm',
      [material],
      'Hamlet',
      'Lighting Design',
      { 'dept-1': 'Lighting Design' }
    )
    expect(result.hits).toHaveLength(1)
    expect(result.hits[0].materialId).toBe('m-1')
    expect(result.summary).toBe('The team favors warm practicals.')
  })

  it('returns empty hits and no-results summary when nothing matches', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"summary": "No materials found for this query."}' }],
    })
    const { searchWithSummary } = await import('@/lib/actions/agents')
    const result = await searchWithSummary(
      'costume',
      [material],
      'Hamlet',
      'Lighting Design',
      { 'dept-1': 'Lighting Design' }
    )
    expect(result.hits).toHaveLength(0)
  })

  it('throws Unauthorized when no user session', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const { searchWithSummary } = await import('@/lib/actions/agents')
    await expect(
      searchWithSummary('test', [], 'Hamlet', 'Lighting', {})
    ).rejects.toThrow('Unauthorized')
  })
})

// ── summarizeDepartment ───────────────────────────────────────────────────────

describe('summarizeDepartment', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
  })

  it('returns department summary with counts', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{
        type: 'text',
        text: '{"summary": "The lighting direction is mostly decided.", "decidedCount": 2, "proposedCount": 1, "exploratoryCount": 0}',
      }],
    })
    const { summarizeDepartment } = await import('@/lib/actions/agents')
    const result = await summarizeDepartment(
      [
        { ...material, state: 'decided' },
        { ...material, id: 'm-2', state: 'decided' },
        { ...material, id: 'm-3', state: 'proposed' },
      ],
      'Hamlet',
      'Lighting Design'
    )
    expect(result.summary).toBe('The lighting direction is mostly decided.')
    expect(result.decidedCount).toBe(2)
    expect(result.proposedCount).toBe(1)
    expect(result.exploratoryCount).toBe(0)
  })

  it('throws Unauthorized when no user session', async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } })
    const { summarizeDepartment } = await import('@/lib/actions/agents')
    await expect(summarizeDepartment([], 'Hamlet', 'Lighting Design')).rejects.toThrow('Unauthorized')
  })

  it('returns fallback on malformed Claude JSON', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'not json' }],
    })
    const { summarizeDepartment } = await import('@/lib/actions/agents')
    const result = await summarizeDepartment([material], 'Hamlet', 'Lighting Design')
    expect(typeof result.summary).toBe('string')
    expect(typeof result.decidedCount).toBe('number')
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/lib/actions/agents.test.ts
```

Expected: FAIL — `@/lib/actions/agents` not found.

- [ ] **Step 3: Implement `lib/actions/agents.ts`**

```ts
'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildTaggingPrompt } from '@/lib/agents/tagging'
import { buildSearchPrompt, filterMaterialsByQuery } from '@/lib/agents/search'
import { buildSummaryPrompt } from '@/lib/agents/summary'
import type {
  Material,
  AgentTagSuggestion,
  AgentSearchResult,
  AgentSummaryResult,
} from '@/lib/types/domain'

const MODEL = 'claude-sonnet-4-5'

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

async function assertAuthenticated(): Promise<void> {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
}

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

function parseJson<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

export async function suggestTags(
  material: Material,
  showName: string,
  departmentName: string,
  existingTagsAcrossDept: string[]
): Promise<AgentTagSuggestion> {
  await assertAuthenticated()

  const prompt = buildTaggingPrompt(material, showName, departmentName, existingTagsAcrossDept)
  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = extractText(response)
  return parseJson<AgentTagSuggestion>(text, { tags: [], rationale: 'Could not parse suggestion.' })
}

export async function searchWithSummary(
  query: string,
  materials: Material[],
  showName: string,
  departmentName: string,
  departmentNameById: Record<string, string>
): Promise<AgentSearchResult> {
  await assertAuthenticated()

  const hits = filterMaterialsByQuery(materials, query)
  const prompt = buildSearchPrompt(query, hits, showName, departmentName)
  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = extractText(response)
  const parsed = parseJson<{ summary: string }>(text, { summary: 'No summary available.' })

  return {
    hits: hits.map((m) => ({
      materialId: m.id,
      title: m.title,
      department: departmentNameById[m.departmentId] ?? 'Unknown',
      state: m.state,
      snippet: m.description ?? m.body ?? m.url ?? '',
    })),
    summary: parsed.summary,
  }
}

export async function summarizeDepartment(
  materials: Material[],
  showName: string,
  departmentName: string
): Promise<AgentSummaryResult> {
  await assertAuthenticated()

  const prompt = buildSummaryPrompt(materials, showName, departmentName)
  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 768,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = extractText(response)
  const decided = materials.filter((m) => m.state === 'decided').length
  const proposed = materials.filter((m) => m.state === 'proposed').length
  const exploratory = materials.filter((m) => m.state === 'exploratory').length

  return parseJson<AgentSummaryResult>(text, {
    department: departmentName,
    summary: 'Could not generate summary.',
    decidedCount: decided,
    proposedCount: proposed,
    exploratoryCount: exploratory,
  })
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/lib/actions/agents.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/actions/agents.ts __tests__/lib/actions/agents.test.ts
git commit -m "feat: add agent Server Actions for tagging, search, and summary"
```

---

## Task 5: TagSuggestionButton component

**Files:**
- Create: `components/agents/TagSuggestionButton.tsx`
- Create: `__tests__/components/agents/TagSuggestionButton.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/agents/TagSuggestionButton.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Material } from '@/lib/types/domain'

vi.mock('@/lib/actions/agents', () => ({
  suggestTags: vi.fn().mockResolvedValue({
    tags: ['act-1', 'warm-tones'],
    rationale: 'Tags reflect scene and mood.',
  }),
}))

const material: Material = {
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'exploratory',
  title: 'Lighting Plot',
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-06-14T00:00:00Z',
}

describe('TagSuggestionButton', () => {
  it('renders the suggest tags button', async () => {
    const { TagSuggestionButton } = await import('@/components/agents/TagSuggestionButton')
    render(
      <TagSuggestionButton
        material={material}
        showName="Hamlet"
        departmentName="Lighting Design"
        existingTags={[]}
        onAccept={vi.fn()}
      />
    )
    expect(screen.getByText(/Suggest tags/i)).toBeInTheDocument()
  })

  it('calls suggestTags and shows suggestions on click', async () => {
    const { TagSuggestionButton } = await import('@/components/agents/TagSuggestionButton')
    render(
      <TagSuggestionButton
        material={material}
        showName="Hamlet"
        departmentName="Lighting Design"
        existingTags={[]}
        onAccept={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Suggest tags/i))
    await waitFor(() => {
      expect(screen.getByText('act-1')).toBeInTheDocument()
      expect(screen.getByText('warm-tones')).toBeInTheDocument()
    })
  })

  it('calls onAccept with selected tags when Accept is clicked', async () => {
    const { TagSuggestionButton } = await import('@/components/agents/TagSuggestionButton')
    const onAccept = vi.fn()
    render(
      <TagSuggestionButton
        material={material}
        showName="Hamlet"
        departmentName="Lighting Design"
        existingTags={[]}
        onAccept={onAccept}
      />
    )
    fireEvent.click(screen.getByText(/Suggest tags/i))
    await waitFor(() => expect(screen.getByText('act-1')).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Accept all/i))
    expect(onAccept).toHaveBeenCalledWith(['act-1', 'warm-tones'])
  })

  it('shows loading state while fetching', async () => {
    const { suggestTags } = await import('@/lib/actions/agents')
    vi.mocked(suggestTags).mockImplementationOnce(
      () => new Promise((resolve) => setTimeout(() => resolve({ tags: [], rationale: '' }), 100))
    )
    const { TagSuggestionButton } = await import('@/components/agents/TagSuggestionButton')
    render(
      <TagSuggestionButton
        material={material}
        showName="Hamlet"
        departmentName="Lighting Design"
        existingTags={[]}
        onAccept={vi.fn()}
      />
    )
    fireEvent.click(screen.getByText(/Suggest tags/i))
    expect(screen.getByText(/Thinking/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/components/agents/TagSuggestionButton.test.tsx
```

- [ ] **Step 3: Implement `components/agents/TagSuggestionButton.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { suggestTags } from '@/lib/actions/agents'
import type { Material } from '@/lib/types/domain'

type Props = {
  material: Material
  showName: string
  departmentName: string
  existingTags: string[]
  onAccept: (tags: string[]) => void
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; tags: string[]; rationale: string }
  | { phase: 'error'; message: string }

export function TagSuggestionButton({
  material,
  showName,
  departmentName,
  existingTags,
  onAccept,
}: Props) {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [, startTransition] = useTransition()

  function handleSuggest() {
    setState({ phase: 'loading' })
    startTransition(async () => {
      try {
        const result = await suggestTags(material, showName, departmentName, existingTags)
        setState({ phase: 'done', tags: result.tags, rationale: result.rationale })
      } catch {
        setState({ phase: 'error', message: 'Failed to get suggestions.' })
      }
    })
  }

  function handleAcceptAll() {
    if (state.phase !== 'done') return
    onAccept(state.tags)
    setState({ phase: 'idle' })
  }

  function handleDismiss() {
    setState({ phase: 'idle' })
  }

  if (state.phase === 'idle') {
    return (
      <button
        onClick={handleSuggest}
        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 border border-purple-800 hover:border-purple-600 rounded px-2 py-1 transition-colors"
      >
        <span>✦</span>
        Suggest tags
      </button>
    )
  }

  if (state.phase === 'loading') {
    return (
      <span className="text-xs text-purple-400 animate-pulse">Thinking…</span>
    )
  }

  if (state.phase === 'error') {
    return (
      <span className="text-xs text-red-400">
        {state.message}{' '}
        <button onClick={handleDismiss} className="underline">dismiss</button>
      </span>
    )
  }

  // phase === 'done'
  return (
    <div className="mt-2 p-2 bg-purple-950/30 border border-purple-800 rounded text-xs space-y-2">
      <p className="text-purple-300 text-[10px] uppercase tracking-wider">AI suggestions</p>
      <div className="flex flex-wrap gap-1">
        {state.tags.map((tag) => (
          <span
            key={tag}
            className="bg-purple-900/50 text-purple-200 px-2 py-0.5 rounded"
          >
            {tag}
          </span>
        ))}
      </div>
      {state.rationale && (
        <p className="text-purple-400 text-[10px]">{state.rationale}</p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleAcceptAll}
          className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded"
        >
          Accept all
        </button>
        <button
          onClick={handleDismiss}
          className="text-xs text-purple-400 hover:text-purple-300"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/components/agents/TagSuggestionButton.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/agents/TagSuggestionButton.tsx __tests__/components/agents/TagSuggestionButton.test.tsx
git commit -m "feat: add TagSuggestionButton component with tests"
```

---

## Task 6: SearchBar component

**Files:**
- Create: `components/agents/SearchBar.tsx`
- Create: `__tests__/components/agents/SearchBar.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/agents/SearchBar.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Material } from '@/lib/types/domain'

vi.mock('@/lib/actions/agents', () => ({
  searchWithSummary: vi.fn().mockResolvedValue({
    hits: [
      {
        materialId: 'm-1',
        title: 'Lighting Plot',
        department: 'Lighting Design',
        state: 'proposed',
        snippet: 'Dark atmospheric look',
      },
    ],
    summary: 'The team is pursuing a dark moody aesthetic.',
  }),
}))

const material: Material = {
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'proposed',
  title: 'Lighting Plot',
  description: 'Dark atmospheric look',
  url: null,
  storagePath: null,
  body: null,
  tags: ['dark'],
  createdAt: '2026-06-14T00:00:00Z',
}

describe('SearchBar', () => {
  it('renders a search input', async () => {
    const { SearchBar } = await import('@/components/agents/SearchBar')
    render(
      <SearchBar
        materials={[material]}
        showName="Hamlet"
        departmentNameById={{ 'dept-1': 'Lighting Design' }}
      />
    )
    expect(screen.getByPlaceholderText(/Search materials/i)).toBeInTheDocument()
  })

  it('calls searchWithSummary and shows results after submission', async () => {
    const { SearchBar } = await import('@/components/agents/SearchBar')
    render(
      <SearchBar
        materials={[material]}
        showName="Hamlet"
        departmentNameById={{ 'dept-1': 'Lighting Design' }}
      />
    )
    const input = screen.getByPlaceholderText(/Search materials/i)
    fireEvent.change(input, { target: { value: 'dark' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(screen.getByText('Lighting Plot')).toBeInTheDocument()
      expect(screen.getByText(/dark moody aesthetic/i)).toBeInTheDocument()
    })
  })

  it('shows hit count after search', async () => {
    const { SearchBar } = await import('@/components/agents/SearchBar')
    render(
      <SearchBar
        materials={[material]}
        showName="Hamlet"
        departmentNameById={{ 'dept-1': 'Lighting Design' }}
      />
    )
    const input = screen.getByPlaceholderText(/Search materials/i)
    fireEvent.change(input, { target: { value: 'dark' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => {
      expect(screen.getByText(/1 result/i)).toBeInTheDocument()
    })
  })

  it('clears results when input is cleared', async () => {
    const { SearchBar } = await import('@/components/agents/SearchBar')
    render(
      <SearchBar
        materials={[material]}
        showName="Hamlet"
        departmentNameById={{ 'dept-1': 'Lighting Design' }}
      />
    )
    const input = screen.getByPlaceholderText(/Search materials/i)
    fireEvent.change(input, { target: { value: 'dark' } })
    fireEvent.submit(input.closest('form')!)
    await waitFor(() => expect(screen.getByText('Lighting Plot')).toBeInTheDocument())
    fireEvent.change(input, { target: { value: '' } })
    expect(screen.queryByText('Lighting Plot')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/components/agents/SearchBar.test.tsx
```

- [ ] **Step 3: Implement `components/agents/SearchBar.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { searchWithSummary } from '@/lib/actions/agents'
import type { Material, AgentSearchResult, MaterialState } from '@/lib/types/domain'

type Props = {
  materials: Material[]
  showName: string
  departmentNameById: Record<string, string>
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; result: AgentSearchResult; query: string }
  | { phase: 'error'; message: string }

const STATE_BADGE: Record<MaterialState, string> = {
  decided: 'bg-green-900 text-green-300',
  proposed: 'bg-amber-900 text-amber-300',
  exploratory: 'bg-neutral-700 text-neutral-400',
}

export function SearchBar({ materials, showName, departmentNameById }: Props) {
  const [query, setQuery] = useState('')
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [, startTransition] = useTransition()

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setQuery(e.target.value)
    if (!e.target.value.trim()) {
      setState({ phase: 'idle' })
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    // Use the first department name as context (or 'Show' for cross-dept search)
    const deptName = Object.values(departmentNameById)[0] ?? 'All departments'
    setState({ phase: 'loading' })
    startTransition(async () => {
      try {
        const result = await searchWithSummary(q, materials, showName, deptName, departmentNameById)
        setState({ phase: 'done', result, query: q })
      } catch {
        setState({ phase: 'error', message: 'Search failed.' })
      }
    })
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <span className="text-purple-400 text-sm">✦</span>
        <input
          type="search"
          value={query}
          onChange={handleChange}
          placeholder="Search materials…"
          className="flex-1 bg-neutral-800 border border-neutral-700 focus:border-purple-600 rounded px-3 py-1.5 text-sm text-white placeholder-neutral-500 outline-none"
        />
        {state.phase === 'loading' && (
          <span className="text-xs text-purple-400 animate-pulse">Searching…</span>
        )}
      </form>

      {state.phase === 'done' && (
        <div className="mt-2 bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-neutral-700 flex items-center justify-between">
            <span className="text-xs text-neutral-400">
              {state.result.hits.length} result{state.result.hits.length !== 1 ? 's' : ''} for &ldquo;{state.query}&rdquo;
            </span>
            <button
              onClick={() => setState({ phase: 'idle' })}
              className="text-neutral-500 hover:text-neutral-300 text-sm"
            >
              ✕
            </button>
          </div>

          {state.result.summary && (
            <div className="px-3 py-2 bg-purple-950/30 border-b border-purple-900/50">
              <p className="text-[10px] text-purple-400 uppercase tracking-wider mb-1">AI Summary</p>
              <p className="text-xs text-purple-200">{state.result.summary}</p>
            </div>
          )}

          <ul className="divide-y divide-neutral-800 max-h-64 overflow-y-auto">
            {state.result.hits.length === 0 && (
              <li className="px-3 py-3 text-xs text-neutral-500">No matching materials found.</li>
            )}
            {state.result.hits.map((hit) => (
              <li key={hit.materialId} className="px-3 py-2 flex items-start gap-2">
                <span className={`text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${STATE_BADGE[hit.state]}`}>
                  {hit.state}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{hit.title}</p>
                  <p className="text-[10px] text-neutral-500">{hit.department}</p>
                  {hit.snippet && (
                    <p className="text-xs text-neutral-400 truncate">{hit.snippet}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.phase === 'error' && (
        <p className="mt-1 text-xs text-red-400">{state.message}</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/components/agents/SearchBar.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/agents/SearchBar.tsx __tests__/components/agents/SearchBar.test.tsx
git commit -m "feat: add SearchBar component with agent-powered search and tests"
```

---

## Task 7: DepartmentSummaryButton component

**Files:**
- Create: `components/agents/DepartmentSummaryButton.tsx`
- Create: `__tests__/components/agents/DepartmentSummaryButton.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
// __tests__/components/agents/DepartmentSummaryButton.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Material } from '@/lib/types/domain'

vi.mock('@/lib/actions/agents', () => ({
  summarizeDepartment: vi.fn().mockResolvedValue({
    department: 'Lighting Design',
    summary: 'The team has decided on a dark, atmospheric look for the show.',
    decidedCount: 3,
    proposedCount: 2,
    exploratoryCount: 1,
  }),
}))

const material: Material = {
  id: 'm-1',
  departmentId: 'dept-1',
  uploadedBy: 'user-1',
  type: 'image',
  state: 'decided',
  title: 'Final Plot',
  description: null,
  url: null,
  storagePath: null,
  body: null,
  tags: [],
  createdAt: '2026-06-14T00:00:00Z',
}

describe('DepartmentSummaryButton', () => {
  it('renders the summary button', async () => {
    const { DepartmentSummaryButton } = await import('@/components/agents/DepartmentSummaryButton')
    render(
      <DepartmentSummaryButton
        materials={[material]}
        showName="Hamlet"
        departmentName="Lighting Design"
      />
    )
    expect(screen.getByText(/Where we've landed/i)).toBeInTheDocument()
  })

  it('calls summarizeDepartment and shows summary on click', async () => {
    const { DepartmentSummaryButton } = await import('@/components/agents/DepartmentSummaryButton')
    render(
      <DepartmentSummaryButton
        materials={[material]}
        showName="Hamlet"
        departmentName="Lighting Design"
      />
    )
    fireEvent.click(screen.getByText(/Where we've landed/i))
    await waitFor(() => {
      expect(screen.getByText(/dark, atmospheric look/i)).toBeInTheDocument()
    })
  })

  it('shows decided/proposed/exploratory counts after summary', async () => {
    const { DepartmentSummaryButton } = await import('@/components/agents/DepartmentSummaryButton')
    render(
      <DepartmentSummaryButton
        materials={[material]}
        showName="Hamlet"
        departmentName="Lighting Design"
      />
    )
    fireEvent.click(screen.getByText(/Where we've landed/i))
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument()
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('shows loading state while fetching', async () => {
    const { summarizeDepartment } = await import('@/lib/actions/agents')
    vi.mocked(summarizeDepartment).mockImplementationOnce(
      () => new Promise((resolve) =>
        setTimeout(() => resolve({
          department: 'Lighting Design',
          summary: '',
          decidedCount: 0,
          proposedCount: 0,
          exploratoryCount: 0,
        }), 100)
      )
    )
    const { DepartmentSummaryButton } = await import('@/components/agents/DepartmentSummaryButton')
    render(
      <DepartmentSummaryButton
        materials={[material]}
        showName="Hamlet"
        departmentName="Lighting Design"
      />
    )
    fireEvent.click(screen.getByText(/Where we've landed/i))
    expect(screen.getByText(/Summarizing/i)).toBeInTheDocument()
  })

  it('can be dismissed after showing summary', async () => {
    const { DepartmentSummaryButton } = await import('@/components/agents/DepartmentSummaryButton')
    render(
      <DepartmentSummaryButton
        materials={[material]}
        showName="Hamlet"
        departmentName="Lighting Design"
      />
    )
    fireEvent.click(screen.getByText(/Where we've landed/i))
    await waitFor(() => expect(screen.getByText(/dark, atmospheric look/i)).toBeInTheDocument())
    fireEvent.click(screen.getByText(/Dismiss/i))
    expect(screen.queryByText(/dark, atmospheric look/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to verify failure**

```bash
npx vitest run __tests__/components/agents/DepartmentSummaryButton.test.tsx
```

- [ ] **Step 3: Implement `components/agents/DepartmentSummaryButton.tsx`**

```tsx
'use client'

import { useState, useTransition } from 'react'
import { summarizeDepartment } from '@/lib/actions/agents'
import type { Material, AgentSummaryResult } from '@/lib/types/domain'

type Props = {
  materials: Material[]
  showName: string
  departmentName: string
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; result: AgentSummaryResult }
  | { phase: 'error'; message: string }

export function DepartmentSummaryButton({ materials, showName, departmentName }: Props) {
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [, startTransition] = useTransition()

  function handleSummarize() {
    setState({ phase: 'loading' })
    startTransition(async () => {
      try {
        const result = await summarizeDepartment(materials, showName, departmentName)
        setState({ phase: 'done', result })
      } catch {
        setState({ phase: 'error', message: 'Failed to generate summary.' })
      }
    })
  }

  if (state.phase === 'idle') {
    return (
      <button
        onClick={handleSummarize}
        className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 border border-purple-800 hover:border-purple-600 rounded px-2 py-1 transition-colors"
      >
        <span>✦</span>
        Where we've landed
      </button>
    )
  }

  if (state.phase === 'loading') {
    return <span className="text-xs text-purple-400 animate-pulse">Summarizing…</span>
  }

  if (state.phase === 'error') {
    return (
      <span className="text-xs text-red-400">
        {state.message}{' '}
        <button onClick={() => setState({ phase: 'idle' })} className="underline">retry</button>
      </span>
    )
  }

  // phase === 'done'
  const { result } = state
  return (
    <div className="bg-purple-950/30 border border-purple-800 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-purple-400 uppercase tracking-wider">
          ✦ Where we've landed — {departmentName}
        </p>
        <button
          onClick={() => setState({ phase: 'idle' })}
          className="text-purple-500 hover:text-purple-300 text-sm"
        >
          Dismiss
        </button>
      </div>
      <p className="text-sm text-purple-100">{result.summary}</p>
      <div className="flex gap-4 text-xs">
        <span className="text-green-400">
          <span className="font-semibold">{result.decidedCount}</span> decided
        </span>
        <span className="text-amber-400">
          <span className="font-semibold">{result.proposedCount}</span> proposed
        </span>
        <span className="text-neutral-400">
          <span className="font-semibold">{result.exploratoryCount}</span> exploratory
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run __tests__/components/agents/DepartmentSummaryButton.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/agents/DepartmentSummaryButton.tsx __tests__/components/agents/DepartmentSummaryButton.test.tsx
git commit -m "feat: add DepartmentSummaryButton component with tests"
```

---

## Task 8: Wire agents into DepartmentClient

The `DepartmentClient` already receives `materials`, `orgId`, `showId`, `deptId`, and `allowReopen` from `DepartmentPage`. We need to add `claudeEnabled`, `showName`, and `departmentName` props, then integrate `TagSuggestionButton` and `DepartmentSummaryButton`.

**Files:**
- Modify: `app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/DepartmentClient.tsx`
- Modify: `app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.tsx`
- Modify: `__tests__/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.test.tsx`

- [ ] **Step 1: Update `DepartmentClient.tsx` props interface**

Add three new props to the `Props` type at the top of the file:

```ts
type Props = {
  materials: MaterialWithUrl[]
  notesByMaterial: Record<string, NoteWithAuthors[]>
  orgId: string
  showId: string
  deptId: string
  allowReopen: boolean
  claudeEnabled: boolean       // NEW
  showName: string             // NEW
  departmentName: string       // NEW
}
```

- [ ] **Step 2: Add imports to `DepartmentClient.tsx`**

Add at the top of the file (after existing imports):

```ts
import { TagSuggestionButton } from '@/components/agents/TagSuggestionButton'
import { DepartmentSummaryButton } from '@/components/agents/DepartmentSummaryButton'
import { updateTags } from '@/lib/actions/materials'
```

(`updateTags` is already imported via existing `materials` actions — verify and skip if already present.)

- [ ] **Step 3: Destructure new props in `DepartmentClient` function signature**

Change the function signature to destructure `claudeEnabled`, `showName`, and `departmentName`:

```ts
export function DepartmentClient({
  materials, notesByMaterial, orgId, showId, deptId, allowReopen,
  claudeEnabled, showName, departmentName,
}: Props) {
```

- [ ] **Step 4: Add `DepartmentSummaryButton` to the toolbar**

In the toolbar `div` (the row containing the tab buttons and "+ Add Material" button), add the summary button when `claudeEnabled` is true. Place it between the tab group and the upload button:

```tsx
{claudeEnabled && (
  <DepartmentSummaryButton
    materials={materials}
    showName={showName}
    departmentName={departmentName}
  />
)}
```

- [ ] **Step 5: Add `TagSuggestionButton` to the `DetailPanel`**

In the `DetailPanel` component, add the button inside the Tags section, after the tags display and add-tag input. The `DetailPanel` receives `material` as a prop but needs `showName`, `departmentName`, and `existingTags`. Add these three to `DetailPanel`'s local props type and pass them through from `DepartmentClient`.

In the `DepartmentClient` body, when rendering `DetailPanel`, pass:

```tsx
<DetailPanel
  material={selected}
  allowReopen={allowReopen}
  newTag={newTag}
  onNewTagChange={setNewTag}
  onClose={() => setSelected(null)}
  onTransition={handleTransition}
  onAddTag={handleAddTag}
  onDelete={handleDelete}
  claudeEnabled={claudeEnabled}
  showName={showName}
  departmentName={departmentName}
  allTags={[...new Set(materials.flatMap((m) => m.tags))]}
  onAcceptSuggestedTags={async (materialId, currentTags, suggestedTags) => {
    startTransition(async () => {
      const merged = [...new Set([...currentTags, ...suggestedTags])]
      await updateTags(materialId, merged)
    })
  }}
/>
```

Inside `DetailPanel`, add to the props type:

```ts
claudeEnabled: boolean
showName: string
departmentName: string
allTags: string[]
onAcceptSuggestedTags: (materialId: string, currentTags: string[], suggested: string[]) => void
```

And inside the Tags section of `DetailPanel`, after the existing tag input row, add:

```tsx
{claudeEnabled && (
  <TagSuggestionButton
    material={material}
    showName={showName}
    departmentName={departmentName}
    existingTags={allTags}
    onAccept={(suggested) => onAcceptSuggestedTags(material.id, material.tags, suggested)}
  />
)}
```

- [ ] **Step 6: Update `page.tsx` to pass new props**

In `app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.tsx`, the `org` object is already in scope (fetched via `getOrgBySlug`). The `show` object provides `name`. The `dept` object provides `name`. Pass them to `DepartmentClient`:

```tsx
<DepartmentClient
  materials={materials}
  notesByMaterial={notesByMaterial}
  orgId={org.id}
  showId={show.id}
  deptId={dept.id}
  allowReopen={show.allowReopen}
  claudeEnabled={org.settings.claudeEnabled}
  showName={show.name}
  departmentName={dept.name}
/>
```

- [ ] **Step 7: Update `page.test.tsx` to pass `claudeEnabled`, `showName`, and `departmentName`**

In `__tests__/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.test.tsx`, update the `DepartmentClient` mock to accept the new props without error. The mock currently returns `<div data-testid="dept-client" />`, which is sufficient — no test change needed as long as TypeScript is satisfied. Verify the mock matches the updated prop signature.

- [ ] **Step 8: Run all tests to verify no regressions**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 9: Commit**

```bash
git add "app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/DepartmentClient.tsx" \
        "app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.tsx" \
        "__tests__/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.test.tsx"
git commit -m "feat: wire TagSuggestionButton and DepartmentSummaryButton into DepartmentClient behind claudeEnabled gate"
```

---

## Task 9: Wire SearchBar into Show detail page

**Files:**
- Modify: `app/(app)/[orgSlug]/shows/[showSlug]/page.tsx`
- Modify: `__tests__/app/(app)/[orgSlug]/shows/[showSlug]/page.test.tsx`

- [ ] **Step 1: Add `getMaterialsByShow` import to show detail page**

In `app/(app)/[orgSlug]/shows/[showSlug]/page.tsx`, add:

```ts
import { getMaterialsByShow } from '@/lib/data/materials'
import { SearchBar } from '@/components/agents/SearchBar'
```

- [ ] **Step 2: Fetch materials when `claudeEnabled`**

In the `ShowDetailPage` server component body, after fetching `show`, conditionally fetch materials:

```ts
const materials = org.settings.claudeEnabled
  ? await getMaterialsByShow(show.id)
  : []

const departmentNameById = Object.fromEntries(
  show.departments.map((d) => [d.id, d.name])
)
```

- [ ] **Step 3: Add `SearchBar` to the show header nav area**

In the JSX, inside the show header section (where the Meetings nav link is), add the `SearchBar` conditionally after the existing `nav` element:

```tsx
{org.settings.claudeEnabled && (
  <div className="mt-4 max-w-md">
    <SearchBar
      materials={materials}
      showName={show.name}
      departmentNameById={departmentNameById}
    />
  </div>
)}
```

- [ ] **Step 4: Update the show detail page test fixture to include `claudeEnabled: false`**

In `__tests__/app/(app)/[orgSlug]/shows/[showSlug]/page.test.tsx`, verify that the `org` mock fixture has `settings: { claudeEnabled: false }`. Add the mock for `getMaterialsByShow` returning `[]`:

```ts
vi.mock('@/lib/data/materials', () => ({
  getMaterialsByShow: vi.fn().mockResolvedValue([]),
}))
```

Add a mock for `SearchBar` (since it's a Client Component using Server Actions):

```ts
vi.mock('@/components/agents/SearchBar', () => ({
  SearchBar: () => null,
}))
```

- [ ] **Step 5: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/[orgSlug]/shows/[showSlug]/page.tsx" \
        "__tests__/app/(app)/[orgSlug]/shows/[showSlug]/page.test.tsx"
git commit -m "feat: add SearchBar to show detail page behind claudeEnabled gate"
```

---

## Task 10: Full test suite verification

- [ ] **Step 1: Run the complete test suite**

```bash
npx vitest run
```

Expected: all tests pass with no regressions from prior plans.

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Verify `claudeEnabled = false` hides all agent UI (manual check)**

In `.env.local`, ensure Supabase has `claude_enabled = false` for the test org. Run `npm run dev` and confirm:
- No "Suggest tags" button appears in the DetailPanel
- No "Where we've landed" button appears in the DepartmentClient toolbar
- No `SearchBar` appears on the Show detail page

Then toggle `claude_enabled = true` via Supabase Studio and confirm each UI entry point appears.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: all agent orchestration tests pass, claudeEnabled gate verified"
```

---

## Spec Coverage Checklist

| Requirement | Task |
|---|---|
| `@anthropic-ai/sdk` installed, API key in server env only | Task 1 |
| `AgentTagSuggestion`, `AgentSearchResult`, `AgentSummaryResult` domain types | Task 2 |
| `buildTaggingPrompt` pure helper with tests | Task 3 |
| `buildSearchPrompt` + `filterMaterialsByQuery` pure helpers with tests | Task 3 |
| `buildSummaryPrompt` pure helper with tests | Task 3 |
| `suggestTags` Server Action: authenticated, calls Claude, returns parsed JSON | Task 4 |
| `searchWithSummary` Server Action: authenticated, keyword filter + Claude summary | Task 4 |
| `summarizeDepartment` Server Action: authenticated, calls Claude, returns parsed JSON | Task 4 |
| All three actions: graceful fallback on malformed Claude JSON | Task 4 |
| All three actions: throw `Unauthorized` when no user session | Task 4 |
| `TagSuggestionButton`: renders, calls action, shows suggestions, calls `onAccept` | Task 5 |
| `SearchBar`: renders, submits query, shows hits + AI summary, clears on empty | Task 6 |
| `DepartmentSummaryButton`: renders, calls action, shows counts + summary, dismisses | Task 7 |
| `DepartmentClient` gated on `claudeEnabled` prop | Task 8 |
| `DepartmentClient` shows `TagSuggestionButton` in DetailPanel when `claudeEnabled` | Task 8 |
| `DepartmentClient` shows `DepartmentSummaryButton` in toolbar when `claudeEnabled` | Task 8 |
| `DepartmentPage` passes `org.settings.claudeEnabled` to `DepartmentClient` | Task 8 |
| Show detail page shows `SearchBar` when `claudeEnabled`, hidden when false | Task 9 |
| API key never reaches browser (all Claude calls in Server Actions only) | Tasks 1, 4 |
| Single-turn pattern: no streaming, no chaining, no agent-to-agent calls | Task 4 |
| No new Supabase tables or migrations | all tasks |

---

### Critical Files for Implementation

- `/Users/kevdog/Documents/code/learning_agents/lib/actions/agents.ts`
- `/Users/kevdog/Documents/code/learning_agents/lib/agents/tagging.ts`
- `/Users/kevdog/Documents/code/learning_agents/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/DepartmentClient.tsx`
- `/Users/kevdog/Documents/code/learning_agents/lib/types/domain.ts`
- `/Users/kevdog/Documents/code/learning_agents/app/(app)/[orgSlug]/shows/[showSlug]/departments/[deptSlug]/page.tsx`
