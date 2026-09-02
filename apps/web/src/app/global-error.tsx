'use client'
// global-error must be a client component

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pl">
      <body>
        <div className="flex h-screen flex-col items-center justify-center space-y-4">
          <h2 className="text-2xl font-bold">Wystąpił błąd krytyczny</h2>
          <p className="text-text-secondary">{error.message || "Aplikacja natrafiła na problem."}</p>
          <button
            onClick={() => reset()}
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90"
          >
            Spróbuj ponownie
          </button>
        </div>
      </body>
    </html>
  )
}
