import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

describe('MDR No Metric Alarm (MDR-NO-METRIC-ALARM)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('physiological_data_ingest does not have any notification triggers @REQ: MDR-NO-METRIC-ALARM', async () => {
    // We check information_schema.triggers to ensure there are no triggers 
    // that might send alarm/notifications upon raw data ingest.
    const triggers = await sql`
      SELECT trigger_name 
      FROM information_schema.triggers 
      WHERE event_object_table = 'physiological_data_ingest'
      AND trigger_schema = 'public'
    `;
    
    // There shouldn't be any triggers on physiological_data_ingest that broadcast logic.
    // If we have some technical triggers (like audit), we can filter them, 
    // but typically raw tables shouldn't have business logic triggers.
    const businessTriggers = triggers.filter(t => t.trigger_name.includes('alarm') || t.trigger_name.includes('notify'));
    expect(businessTriggers.length).toBe(0);
  });
});
