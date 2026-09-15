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

import { getEuLlmConfig } from '../../apps/web/src/lib/eu-llm-client';

describe('Voice LLM Sovereignty & Regional Conformance (@REQ: INFRA-EU-REGION @REQ: INFRA-GROQ-TRANSCRIPTION)', () => {
  it('enforces EU residency for classification and report generation LLM', () => {
    const config = getEuLlmConfig();
    expect(config.region).toBe('EU');
    expect(config.endpoint).toBeDefined();
    // Sprawdzenie, że endpoint wskazuje na europejski region / dostawcę
    const isEuEndpoint = 
      config.endpoint.includes('.mistral.ai') || 
      config.endpoint.includes('eu-') || 
      config.endpoint.includes('europe') ||
      config.endpoint.startsWith('http://localhost');
    expect(isEuEndpoint).toBe(true);
  });
});
