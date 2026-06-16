'use server'

import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildTaggingPrompt } from '@/lib/agents/tagging'
import { buildSearchPrompt, filterMaterialsByQuery } from '@/lib/agents/search'
import { buildSummaryPrompt } from '@/lib/agents/summary'
import { rateLimit } from '@/lib/rate-limit/in-memory'
import {
  AgentDepartmentNameSchema,
  AgentSearchSummarySchema,
  AgentShowNameSchema,
  AgentSummaryResultSchema,
  AgentTagSuggestionSchema,
  AgentTextSchema,
} from '@/lib/schemas/agents'
import type {
  Material,
  AgentTagSuggestion,
  AgentSearchResult,
  AgentSummaryResult,
} from '@/lib/types/domain'

const MODEL = 'claude-sonnet-4-5'
const RATE_LIMIT_PER_MINUTE = 30
const RATE_WINDOW_MS = 60_000

function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

async function requireUserAndLimit(action: string): Promise<{ userId: string }> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const result = rateLimit(`agent:${action}:${user.id}`, RATE_LIMIT_PER_MINUTE, RATE_WINDOW_MS)
  if (!result.ok) {
    throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(result.retryAfterMs / 1000)}s.`)
  }

  return { userId: user.id }
}

function extractText(response: Anthropic.Message): string {
  const block = response.content.find((b) => b.type === 'text')
  return block && block.type === 'text' ? block.text : ''
}

function parseJsonWithSchema<T>(text: string, schema: z.ZodType<T>, fallback: T): T {
  try {
    const raw = JSON.parse(text)
    const result = schema.safeParse(raw)
    return result.success ? result.data : fallback
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
  AgentShowNameSchema.parse(showName)
  AgentDepartmentNameSchema.parse(departmentName)
  await requireUserAndLimit('suggestTags')

  const prompt = buildTaggingPrompt(material, showName, departmentName, existingTagsAcrossDept)
  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  return parseJsonWithSchema<AgentTagSuggestion>(
    extractText(response),
    AgentTagSuggestionSchema,
    { tags: [], rationale: 'Could not parse suggestion.' }
  )
}

export async function searchWithSummary(
  query: string,
  materials: Material[],
  showName: string,
  departmentName: string,
  departmentNameById: Record<string, string>
): Promise<AgentSearchResult> {
  AgentTextSchema.parse(query)
  AgentShowNameSchema.parse(showName)
  AgentDepartmentNameSchema.parse(departmentName)
  await requireUserAndLimit('search')

  const hits = filterMaterialsByQuery(materials, query)
  const prompt = buildSearchPrompt(query, hits, showName, departmentName)
  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  })

  const parsed = parseJsonWithSchema(
    extractText(response),
    AgentSearchSummarySchema,
    { summary: 'No summary available.' }
  )

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
  AgentShowNameSchema.parse(showName)
  AgentDepartmentNameSchema.parse(departmentName)
  await requireUserAndLimit('summary')

  const prompt = buildSummaryPrompt(materials, showName, departmentName)
  const client = getClient()

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 768,
    messages: [{ role: 'user', content: prompt }],
  })

  const decided = materials.filter((m) => m.state === 'decided').length
  const proposed = materials.filter((m) => m.state === 'proposed').length
  const exploratory = materials.filter((m) => m.state === 'exploratory').length

  return parseJsonWithSchema<AgentSummaryResult>(
    extractText(response),
    AgentSummaryResultSchema,
    {
      department: departmentName,
      summary: 'Could not generate summary.',
      decidedCount: decided,
      proposedCount: proposed,
      exploratoryCount: exploratory,
    }
  )
}
