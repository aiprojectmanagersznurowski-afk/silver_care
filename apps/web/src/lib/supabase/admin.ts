import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database.types'

// Ten klient omija RLS, pozwala na zapraszanie uzytkownikow i modyfikacje auth.users
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Brak wymaganych zmiennych środowiskowych SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(
    url,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
