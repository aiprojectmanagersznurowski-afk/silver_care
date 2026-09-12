import Link from 'next/link'
import Image from 'next/image'

export const dynamic = 'force-dynamic'

export default function NotFound() {
  return (
    <div className="flex h-[calc(100vh-100px)] flex-col items-center justify-center space-y-4">
      <div className="mx-auto mb-2 flex justify-center">
        <Image
          src="/logo.png"
          alt="Silver Care"
          width={150}
          height={42}
          className="h-10 w-auto object-contain"
          priority
        />
      </div>
      <h2 className="text-3xl font-bold tracking-tight text-foreground">Strona nie znaleziona</h2>
      <p className="text-text-secondary">Nie mogliśmy odnaleźć strony, której szukasz.</p>
      <Link href="/" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
        Wróć do strony głównej
      </Link>
    </div>
  )
}
