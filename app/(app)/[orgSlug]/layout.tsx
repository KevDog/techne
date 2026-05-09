import { notFound } from 'next/navigation'
import { getOrgBySlug } from '@/lib/data/orgs'

type Props = {
  children: React.ReactNode
  params: Promise<{ orgSlug: string }>
}

export default async function OrgLayout({ children, params }: Props) {
  const { orgSlug } = await params
  const org = await getOrgBySlug(orgSlug)
  if (!org) notFound()
  return <>{children}</>
}
