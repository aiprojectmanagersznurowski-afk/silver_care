import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('VOICE-MEDICAL-STRIP Logic', () => {
  it('API route instructs LLM to separate medical data from the rest @REQ: VOICE-MEDICAL-STRIP', () => {
    // Read the voice processing API route
    const routePath = path.resolve(__dirname, '../../apps/web/src/app/api/voice/process/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');

    // Verify presence of directives defining the 3 streams
    expect(content).toContain('"medical":');
    expect(content).toContain('"discomfort":');
    expect(content).toContain('"behavioral":');
    
    // Check that medical data does not enter the second phase (report generation)
    // The second step prompt should only use discomfort and behavioral variables
    const secondStepStartIdx = content.indexOf('const systemPrompt2');
    const secondStepPromptContent = content.substring(secondStepStartIdx);
    
    expect(secondStepPromptContent).toContain('classified.discomfort');
    expect(secondStepPromptContent).toContain('classified.behavioral');
    expect(secondStepPromptContent).not.toContain('classified.medical');
  });
});
