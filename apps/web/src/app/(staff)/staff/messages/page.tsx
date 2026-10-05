import { StaffMessagesInbox } from '@/components/StaffMessagesInbox'

export const dynamic = 'force-dynamic'

export default async function StaffMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ residentId?: string }>
}) {
  const params = await searchParams;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">
          Wiadomości
        </h1>
        <p className="mt-2 text-muted-foreground">
          Bezpośredni kontakt z rodzinami i opiekunami prawnymi podopiecznych.
        </p>
      </div>

      <StaffMessagesInbox initialResidentId={params?.residentId} />
    </div>
  )
}
