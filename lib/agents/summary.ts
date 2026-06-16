import type { Material } from '@/lib/types/domain'
import { sanitizeForPrompt, sanitizeTags } from './sanitize'

export function buildSummaryPrompt(
  materials: Material[],
  showName: string,
  departmentName: string
): string {
  const cleanShow = sanitizeForPrompt(showName, 200)
  const cleanDept = sanitizeForPrompt(departmentName, 200)

  const decided = materials.filter((m) => m.state === 'decided')
  const proposed = materials.filter((m) => m.state === 'proposed')
  const exploratory = materials.filter((m) => m.state === 'exploratory')

  function formatList(items: Material[]): string {
    if (items.length === 0) return '  (none)'
    return items
      .map((m) => {
        const title = sanitizeForPrompt(m.title, 300)
        const desc = m.description ? `: ${sanitizeForPrompt(m.description, 500)}` : ''
        const tags = m.tags.length > 0 ? ` [${sanitizeTags(m.tags).join(', ')}]` : ''
        return `  - ${title}${desc}${tags}`
      })
      .join('\n')
  }

  return `You are a theatrical design assistant. Summarize the current design status for the ${cleanDept} department of "${cleanShow}".

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
