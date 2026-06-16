import { z } from 'zod'

export const UuidSchema = z.string().uuid()
export const NonEmptyStringSchema = z.string().min(1)

export const MaterialTagSchema = z.string().min(1).max(50).regex(/^[a-z0-9-]+$/)
export const MaterialTagsSchema = z.array(MaterialTagSchema).max(20)

export const NoteBodySchema = z.string().min(1).max(10000)
export const NoteTagsSchema = z.array(z.string().max(50)).optional()

export const MeetingTitleSchema = z.string().min(1).max(200)
export const ScheduledAtSchema = z.string().datetime()
