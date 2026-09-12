import postgres from 'postgres';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function applyMigrations() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error('Missing DATABASE_URL in .env.local');
  }

  const sql = postgres(dbUrl, { prepare: false });

  console.log('1. Applying 20260912210000_resident_metadata.sql...');
  const m1 = fs.readFileSync('supabase/migrations/20260912210000_resident_metadata.sql', 'utf8');
  await sql.unsafe(m1);
  console.log('   ✓ 20260912210000_resident_metadata.sql applied.');

  console.log('2. Applying 20260912211000_reporting_views.sql...');
  const m2 = fs.readFileSync('supabase/migrations/20260912211000_reporting_views.sql', 'utf8');
  await sql.unsafe(m2);
  console.log('   ✓ 20260912211000_reporting_views.sql applied.');

  await sql.end();
  console.log('All BI migrations applied successfully.');
}

applyMigrations().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
