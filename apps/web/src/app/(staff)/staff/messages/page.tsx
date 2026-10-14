import { StaffMessagesInbox } from '@/components/StaffMessagesInbox'

export const dynamic = 'force-dynamic'

export default async function StaffMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ residentId?: string }>
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-col h-[calc(100dvh-5rem)] md:h-[calc(100dvh-6rem)] gap-3 md:gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-semibold tracking-tight text-foreground">
            Wiadomości
          </h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            Bezpośredni kontakt z rodzinami i opiekunami prawnymi podopiecznych.
          </p>
        </div>
      </div>

      <StaffMessagesInbox initialResidentId={params?.residentId} />
    </div>
  )
}
