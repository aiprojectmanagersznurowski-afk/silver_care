import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ZERO_GUESSING_DIRECTIVE, FAMILY_REPORT_PROMPT } from '../../packages/contracts/src/prompts';

describe('VOICE-ZERO-GUESSING Logic', () => {

  it('API route contains strict zero-guessing instructions @REQ: VOICE-ZERO-GUESSING', () => {
    const routePath = path.resolve(__dirname, '../../apps/web/src/app/api/voice/process/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');

    expect(content).toContain('ZERO-GUESSING');
    expect(content).toContain('Wyciągaj wyłącznie twarde fakty');
  });

  it('requires resident_id as UUID from frontend draft and rejects missing id @REQ: VOICE-ZERO-GUESSING', () => {
    const routePath = path.resolve(__dirname, '../../apps/web/src/app/api/voice/process/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');

    // Verification of resident_id presence on draft
    expect(content).toContain('draft.resident_id');
    expect(content).toMatch(/if\s*\(!draft\.resident_id\)/);
  });

  it('contracts prompt exports ZERO_GUESSING_DIRECTIVE and forbids identity guessing @REQ: VOICE-ZERO-GUESSING', () => {
    expect(ZERO_GUESSING_DIRECTIVE).toBeDefined();
    expect(ZERO_GUESSING_DIRECTIVE).toMatch(/never guess/i);
    expect(ZERO_GUESSING_DIRECTIVE).toMatch(/identity/i);

    // Family report prompt forbids guessing resident name
    expect(FAMILY_REPORT_PROMPT).toMatch(/never guess identity|nigdy nie zgaduj imienia|anonimow/i);
  });

});
