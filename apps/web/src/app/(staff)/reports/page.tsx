import { redirect } from 'next/navigation'

interface ReportsPageProps {
  searchParams: Promise<{ resident?: string }>
}

export default async function ReportsRedirectPage({ searchParams }: ReportsPageProps) {
  const { resident } = await searchParams
  const query = resident ? `?resident=${encodeURIComponent(resident)}` : ''
  redirect(`/staff/reports${query}`)
}

