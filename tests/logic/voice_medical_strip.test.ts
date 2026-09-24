import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { MEDICAL_CATEGORIES } from '../../packages/contracts/src/generated/voice';
import { VOICE_PROCESSING_PROMPT } from '../../packages/contracts/src/prompts';
import { validateNoMedicalDataInReport } from '../../packages/contracts/src/validation';

describe('VOICE-MEDICAL-STRIP Logic', () => {

  it('API route instructs LLM to separate medical data from the rest @REQ: VOICE-MEDICAL-STRIP', () => {
    const routePath = path.resolve(__dirname, '../../apps/web/src/app/api/voice/process/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');

    expect(content).toContain('"medical"');
    expect(content).toContain('"discomfort"');
    expect(content).toContain('"behavioral"');
    
    const secondStepStartIdx = content.indexOf('classified.behavioral');
    expect(secondStepStartIdx).toBeGreaterThan(0);
    const secondStepPromptContent = content.substring(secondStepStartIdx);
    expect(secondStepPromptContent).not.toContain('classified.medical');
  });

  it('classifier prompt covers all categories from MEDICAL_CATEGORIES @REQ: VOICE-MEDICAL-STRIP', () => {
    // Every category from contract must be explicitly represented in the prompt
    for (const cat of MEDICAL_CATEGORIES) {
      expect(VOICE_PROCESSING_PROMPT.toLowerCase()).toContain(cat.id.toLowerCase());
    }
  });

  it('REDACT stage rejects texts containing medication names and clinical data @REQ: VOICE-MEDICAL-STRIP', () => {
    const medicalSamples = [
      'Podano 2 tabletki Furaginy o 14:00.',
      'Ciśnienie tętnicze 150/90, saturacja 92%.',
      'Wyniki badań krwi wskazują na podwyższony mocznik.',
      'Zalecenie lekarskie: konsultacja kardiologiczna.'
    ];

    for (const sample of medicalSamples) {
      const check = validateNoMedicalDataInReport(sample);
      expect(check.hasMedical).toBe(true);
    }

    const behavioralClean = 'Senior zjadł ze smakiem podwieczorek i wyszedł do ogrodu na krótki spacer.';
    const cleanCheck = validateNoMedicalDataInReport(behavioralClean);
    expect(cleanCheck.hasMedical).toBe(false);
  });

});
