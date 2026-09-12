import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function run() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    console.error('Error:', error);
    return;
  }
  console.log(`Znaleziono ${users.length} użytkowników:`);
  for (const u of users) {
    console.log({
      id: u.id,
      email: u.email,
      confirmed_at: u.email_confirmed_at,
      app_metadata: u.app_metadata,
      user_metadata: u.user_metadata,
    });
  }
}

run().catch(console.error);
