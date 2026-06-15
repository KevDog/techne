export type OrgSettings = {
  claudeEnabled: boolean
}

export type Org = {
  id: string
  name: string
  slug: string
  settings: OrgSettings
  createdAt: string
}

export type OrgMember = {
  id: string
  orgId: string
  userId: string
  createdAt: string
}

export type CurrentUser = {
  id: string
  email: string
  displayName: string | null
}

export type Season = {
  id: string
  orgId: string
  name: string
  slug: string
  createdAt: string
}

export type Show = {
  id: string
  orgId: string
  seasonId: string | null
  name: string
  slug: string
  approvalMode: 'single' | 'multi'
  allowReopen: boolean
  createdAt: string
}

export type Department = {
  id: string
  showId: string
  name: string
  slug: string
  createdAt: string
}

export type RoleDefinition = {
  id: string
  orgId: string
  showId: string | null
  name: string
  permissions: string[]
  createdAt: string
}

export type ShowMember = {
  id: string
  showId: string
  userId: string
  roleDefinitionId: string
  featured: boolean
  createdAt: string
}

export type Profile = {
  id: string
  displayName: string | null
  updatedAt: string
}

export type MaterialType = 'image' | 'file' | 'link' | 'note'
export type MaterialState = 'exploratory' | 'proposed' | 'decided'

export type Material = {
  id: string
  departmentId: string
  uploadedBy: string
  type: MaterialType
  state: MaterialState
  title: string
  description: string | null
  url: string | null
  storagePath: string | null
  body: string | null
  tags: string[]
  createdAt: string
}

export type Note = {
  id: string
  body: string
  tags: string[]
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
  hiddenAt: string | null
  materialId: string | null
  showId: string | null
  meetingId: string | null
}

export type NoteWithAuthors = Note & {
  createdByName: string
  updatedByName: string
}

export type Meeting = {
  id: string
  showId: string
  title: string
  scheduledAt: string
  startedAt: string | null
  endedAt: string | null
  createdBy: string
  createdAt: string
}

export type MeetingNote = Note

// ── Agent result types ────────────────────────────────────────────────────────

export type AgentTagSuggestion = {
  tags: string[]
  rationale: string
}

export type AgentSearchHit = {
  materialId: string
  title: string
  department: string
  state: MaterialState
  snippet: string
}

export type AgentSearchResult = {
  hits: AgentSearchHit[]
  summary: string
}

export type AgentSummaryResult = {
  department: string
  summary: string
  decidedCount: number
  proposedCount: number
  exploratoryCount: number
}
