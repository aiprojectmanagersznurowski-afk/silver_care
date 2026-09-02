export default function StaffLoading() {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center space-y-4">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      <p className="text-sm text-text-secondary">Pobieranie danych panelu...</p>
    </div>
  )
}
