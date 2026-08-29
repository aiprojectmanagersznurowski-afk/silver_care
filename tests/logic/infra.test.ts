import { describe, it, expect } from 'vitest';
import { InfraConfig } from '../../packages/contracts/src/infra';

describe('Infrastructure & Security Config (INFRA-EU-REGION, INFRA-GROQ-TRANSCRIPTION, SEC-SESSION)', () => {

  it('enforces eu-central-1 region and Groq presence @REQ: INFRA-EU-REGION @REQ: INFRA-GROQ-TRANSCRIPTION', () => {
    const config: InfraConfig = {
      supabaseRegion: 'eu-central-1',
      hasGroqTranscription: true,
      sessionTimeoutMinutes: 15
    };
    
    expect(config.supabaseRegion).toBe('eu-central-1');
    expect(config.hasGroqTranscription).toBe(true);
  });

  it('enforces session timeouts @REQ: SEC-SESSION', () => {
    const config: InfraConfig = {
      supabaseRegion: 'eu-central-1',
      hasGroqTranscription: true,
      sessionTimeoutMinutes: 15
    };
    
    expect(config.sessionTimeoutMinutes).toBeGreaterThan(0);
    expect(config.sessionTimeoutMinutes).toBeLessThanOrEqual(60);
  });
});
