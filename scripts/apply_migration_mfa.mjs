import postgres from 'postgres';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function applyMigration() {
  const sql = postgres(process.env.DATABASE_URL, { prepare: false });
  const migration = fs.readFileSync('supabase/migrations/20260829060000_security_mfa.sql', 'utf8');
  await sql.unsafe(migration);
  await sql.end();
  console.log('Migration applied');
}
applyMigration().catch(console.error);
