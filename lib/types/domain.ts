export type OrgSettings = {
  claude_enabled: boolean
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
