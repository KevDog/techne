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
      .map(
        (m) =>
          `  - ${m.title}${m.description ? `: ${m.description}` : ''}${m.tags.length > 0 ? ` [${m.tags.join(', ')}]` : ''}`
      )
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
