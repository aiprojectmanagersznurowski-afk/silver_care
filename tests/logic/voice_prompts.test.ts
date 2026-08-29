import { describe, it, expect } from 'vitest';
import { VOICE_PROCESSING_PROMPT } from '../../packages/contracts/src/prompts';

describe('Voice Prompts (MDR-NO-INTERPRETATION, VOICE-ZERO-GUESSING, VOICE-MEDICAL-STRIP)', () => {

  it('contains strict extraction rules to prevent guessing @REQ: VOICE-ZERO-GUESSING', () => {
    expect(VOICE_PROCESSING_PROMPT).toMatch(/Extract facts only/i);
    expect(VOICE_PROCESSING_PROMPT).toMatch(/Do not guess/i);
  });

  it('contains ban on medical interpretation and diagnosis @REQ: MDR-NO-INTERPRETATION', () => {
    expect(VOICE_PROCESSING_PROMPT).toMatch(/does not evaluate health/i);
    expect(VOICE_PROCESSING_PROMPT).toMatch(/Do not diagnose/i);
  });

  it('forces 3-stream segregation (MEDICAL, DISCOMFORT, BEHAVIORAL) @REQ: VOICE-MEDICAL-STRIP', () => {
    expect(VOICE_PROCESSING_PROMPT).toContain('MEDICAL:');
    expect(VOICE_PROCESSING_PROMPT).toContain('DISCOMFORT:');
    expect(VOICE_PROCESSING_PROMPT).toContain('BEHAVIORAL:');
  });

});
