/**
 * Sanitize free-text user input before interpolating into an LLM prompt.
 *
 * Strips control chars and replaces backticks/triple-quote sequences that
 * could let an attacker break out of a code fence or quoted block we use
 * to structure prompts. We deliberately preserve normal punctuation —
 * theatrical content uses curly quotes, em-dashes, etc.
 */
export function sanitizeForPrompt(input: string, maxLength = 4000): string {
  return input
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
    .replace(/```/g, "'''")
    .replace(/"""/g, '"​"​"')
    .slice(0, maxLength)
    .trim()
}

export function sanitizeTags(tags: readonly string[], maxTags = 20): string[] {
  return tags
    .filter((t) => typeof t === 'string')
    .map((t) => sanitizeForPrompt(t, 100))
    .filter((t) => t.length > 0)
    .slice(0, maxTags)
}
