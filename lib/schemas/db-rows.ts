import { z } from 'zod'

export const MaterialTypeSchema = z.enum(['note', 'image', 'file', 'link'])
export const MaterialStateSchema = z.enum(['exploratory', 'proposed', 'decided'])
export const ApprovalModeSchema = z.enum(['single', 'multi'])

export const OrgSettingsSchema = z
  .object({ claudeEnabled: z.boolean() })
  .catch({ claudeEnabled: false })

export const ShowDepartmentRefSchema = z.object({ id: z.string() })

export const ShowDepartmentDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  created_at: z.string(),
})

export const ShowMemberSchema = z.object({
  id: z.string(),
  featured: z.boolean(),
  profiles: z.object({ display_name: z.string().nullable() }).nullable(),
  role_definitions: z.object({ name: z.string() }).nullable(),
})

export const ShowSeasonSchema = z.object({ name: z.string(), slug: z.string() }).nullable()

export function parseSeason(raw: unknown): { name: string; slug: string } | null {
  if (raw == null) return null
  const candidate = Array.isArray(raw) ? raw[0] : raw
  const result = ShowSeasonSchema.safeParse(candidate)
  return result.success ? result.data : null
}
