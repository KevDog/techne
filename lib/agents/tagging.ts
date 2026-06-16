import type { Material } from '@/lib/types/domain'
import { sanitizeForPrompt, sanitizeTags } from './sanitize'

export function buildTaggingPrompt(
  material: Material,
  showName: string,
  departmentName: string,
  existingTagsAcrossDept: string[]
): string {
  const cleanShow = sanitizeForPrompt(showName, 200)
  const cleanDept = sanitizeForPrompt(departmentName, 200)
  const cleanTitle = sanitizeForPrompt(material.title, 300)
  const cleanDescription = material.description ? sanitizeForPrompt(material.description, 2000) : ''
  const cleanBody = material.body ? sanitizeForPrompt(material.body, 4000) : ''
  const cleanUrl = material.url ? sanitizeForPrompt(material.url, 500) : ''
  const cleanTags = sanitizeTags(existingTagsAcrossDept)

  const existingTagsText =
    cleanTags.length > 0
      ? `\nExisting tags used in this department (use these for consistency where appropriate): ${cleanTags.join(', ')}`
      : ''

  return `You are a theatrical design assistant helping tag design materials for a production.

Show: ${cleanShow}
Department: ${cleanDept}
Material title: ${cleanTitle}
Material type: ${material.type}
${cleanDescription ? `Description: ${cleanDescription}` : ''}
${cleanBody ? `Content: ${cleanBody}` : ''}
${cleanUrl ? `URL: ${cleanUrl}` : ''}
Current state: ${material.state}${existingTagsText}

Suggest 3–6 concise tags for this material. Tags should be lowercase, hyphenated (e.g. "act-1", "warm-tones", "practical"). Focus on: act/scene reference, visual quality, technique, or design intent.

Respond with valid JSON only, in this exact shape:
{"tags": ["tag-one", "tag-two"], "rationale": "One sentence explaining the tag choices."}`
}
