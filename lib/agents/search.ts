import type { Material } from '@/lib/types/domain'
import { sanitizeForPrompt, sanitizeTags } from './sanitize'

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
  const cleanShow = sanitizeForPrompt(showName, 200)
  const cleanDept = sanitizeForPrompt(departmentName, 200)
  const cleanQuery = sanitizeForPrompt(query, 500)

  const hitsSummary = hits
    .map((m, i) => {
      const title = sanitizeForPrompt(m.title, 300)
      const desc = m.description ? ` — ${sanitizeForPrompt(m.description, 500)}` : ''
      const tags = m.tags.length > 0 ? ` [tags: ${sanitizeTags(m.tags).join(', ')}]` : ''
      return `${i + 1}. [${m.state}] ${title} (${m.type})${desc}${tags}`
    })
    .join('\n')

  return `You are a theatrical design assistant helping a team find relevant design materials.

Show: ${cleanShow}
Department: ${cleanDept}
User query: "${cleanQuery}"

Matching materials found (${hits.length}):
${hitsSummary}

Write a concise summary (2–4 sentences) that synthesizes what these materials reveal about the design direction related to the query. If no materials were found, say so directly.

Respond with valid JSON only:
{"summary": "Your synthesis here."}`
}
