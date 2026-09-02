import Link from 'next/link'

export default function UnauthorizedPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">403</h1>
        <p className="mt-4 text-lg text-text-secondary">Odmowa dostępu: Brak wystarczających uprawnień, by przeglądać tę zawartość.</p>
        <div className="mt-8">
          <Link
            href="/"
            className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            Wróć na stronę główną
          </Link>
        </div>
      </div>
    </div>
  )
}
