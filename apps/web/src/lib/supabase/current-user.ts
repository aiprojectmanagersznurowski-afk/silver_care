import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Zweryfikowany użytkownik bieżącego żądania (WO-NFR-PERF-SCREEN-LOAD, etap 2).
 *
 * supabase.auth.getUser() weryfikuje sesję zapytaniem do Supabase Auth. Layout i strona panelu
 * wołały je osobno, więc jedno wejście na stronę kosztowało kilka zapytań sieciowych.
 * React.cache sprawia, że w obrębie jednego renderowania serwerowego weryfikacja odbywa się raz.
 * Bezpieczeństwo bez zmian: nadal getUser (weryfikacja po stronie Supabase), rola z app_metadata.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})
