import { createClient } from '@supabase/supabase-js'

// Ten klient omija RLS, pozwala na zapraszanie uzytkownikow i modyfikacje auth.users
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder',
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}
