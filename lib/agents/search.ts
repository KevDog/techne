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
    .map(
      (m, i) =>
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
