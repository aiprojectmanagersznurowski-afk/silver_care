import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VOICE-OFFLINE Logic', () => {
  it('database schema supports client_uuid for offline syncing @REQ: VOICE-OFFLINE', () => {
    // Read the voice_offline migration to ensure the schema includes client_uuid
    const migrationPath = path.resolve(__dirname, '../../supabase/migrations/20260902020000_voice_offline.sql');
    let content = '';
    try {
      content = fs.readFileSync(migrationPath, 'utf8');
    } catch(e) {
      // Ignored for testing purposes, assuming migration might not exist in some environments
    }

    expect(content).toContain('ADD COLUMN IF NOT EXISTS client_uuid UUID UNIQUE');
  });

  it('API route expects client_uuid field from form data @REQ: VOICE-OFFLINE', () => {
    // Read the voice transcribe API route
    const routePath = path.resolve(__dirname, '../../apps/web/src/app/api/voice/transcribe/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');

    // Verify presence of directives defining the client_uuid
    expect(content).toContain("formData.get('client_uuid')");
  });
});
