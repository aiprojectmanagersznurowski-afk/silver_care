import type { SupabaseClient } from '@supabase/supabase-js'

/** Prywatny bucket zdjęć podopiecznych (SC-ADM-25, migracja 20261117120000). */
export const RESIDENT_PHOTO_BUCKET = 'resident-photos'

/** Czas ważności podpisanego linku do zdjęcia (sekundy). */
export const RESIDENT_PHOTO_URL_TTL = 3600

/** Ścieżka pliku zdjęcia: <organization_id>/<resident_id>/<plik> (tego wymagają polityki storage). */
export function residentPhotoPath(organizationId: string, residentId: string, fileName: string): string {
  return `${organizationId}/${residentId}/${fileName}`
}

/**
 * Podpisane linki do zdjęć podopiecznych (@REQ: ADM-RESIDENT-PHOTO). Podpisuje klient sesji, więc
 * o dostępie decyduje RLS storage: plik bez uprawnienia nie dostaje linku. Brak ścieżki lub błąd = brak zdjęcia
 * (interfejs pokazuje inicjał), nigdy zdjęcie zastępcze. W logu wyłącznie liczba ścieżek, bez nich samych.
 */
export async function residentPhotoUrls(
  supabase: SupabaseClient,
  paths: Array<string | null | undefined>
): Promise<Record<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  if (unique.length === 0) return {}

  const { data, error } = await supabase.storage.from(RESIDENT_PHOTO_BUCKET).createSignedUrls(unique, RESIDENT_PHOTO_URL_TTL)
  if (error || !data) {
    console.error('[zdjecia-podopiecznych] podpisywanie nieudane', { count: unique.length })
    return {}
  }

  const urls: Record<string, string> = {}
  for (const item of data) {
    if (item.path && item.signedUrl && !item.error) urls[item.path] = item.signedUrl
  }
  return urls
}
