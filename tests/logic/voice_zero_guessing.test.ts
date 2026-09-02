import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VOICE-ZERO-GUESSING Logic', () => {
  it('API route contains strict zero-guessing instructions @REQ: VOICE-ZERO-GUESSING', () => {
    // Read the voice processing API route
    const routePath = path.resolve(__dirname, '../../apps/web/src/app/api/voice/process/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');

    // Verify presence of zero-guessing directives
    expect(content).toContain('ZERO-GUESSING');
    expect(content).toContain('Nie zmyślaj');
    expect(content).toContain('nie domyślaj się');
    expect(content).toContain('Wyciągaj wyłącznie twarde fakty');
  });
});
