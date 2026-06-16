import { z } from 'zod'

export const AgentTagSuggestionSchema = z.object({
  tags: z.array(z.string()).max(20),
  rationale: z.string().max(2000).default(''),
})

export const AgentSearchSummarySchema = z.object({
  summary: z.string().max(4000),
})

export const AgentSummaryResultSchema = z.object({
  department: z.string().default(''),
  summary: z.string().max(8000),
  decidedCount: z.number().int().min(0),
  proposedCount: z.number().int().min(0),
  exploratoryCount: z.number().int().min(0),
})

// Inputs accepted by agent server actions
export const AgentTextSchema = z.string().min(1).max(500)
export const AgentDepartmentNameSchema = z.string().min(1).max(200)
export const AgentShowNameSchema = z.string().min(1).max(200)
