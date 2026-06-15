import type { Material } from '@/lib/types/domain'

export function buildTaggingPrompt(
  material: Material,
  showName: string,
  departmentName: string,
  existingTagsAcrossDept: string[]
): string {
  const existingTagsText =
    existingTagsAcrossDept.length > 0
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
