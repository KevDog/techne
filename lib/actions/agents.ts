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
  const {
    data: { user },
  } = await supabase.auth.getUser()
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
