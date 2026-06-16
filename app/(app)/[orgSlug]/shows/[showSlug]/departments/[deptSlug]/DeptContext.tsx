'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type DeptContextValue = {
  orgId: string
  showId: string
  deptId: string
  allowReopen: boolean
  claudeEnabled: boolean
  showName: string
  departmentName: string
}

const DeptContext = createContext<DeptContextValue | null>(null)

export function DeptProvider({
  value,
  children,
}: {
  value: DeptContextValue
  children: ReactNode
}): React.ReactElement {
  return <DeptContext.Provider value={value}>{children}</DeptContext.Provider>
}

export function useDeptContext(): DeptContextValue {
  const ctx = useContext(DeptContext)
  if (!ctx) throw new Error('useDeptContext must be used within <DeptProvider>')
  return ctx
}
