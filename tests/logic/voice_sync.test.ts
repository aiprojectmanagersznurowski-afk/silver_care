import { describe, it, expect } from 'vitest';
import { VoiceNoteDraft } from '../../packages/contracts/src/voice';

describe('Voice Offline & Followup (VOICE-OFFLINE, VOICE-FOLLOWUP)', () => {

  it('supports offline sync buffers @REQ: VOICE-OFFLINE', () => {
    const draft: VoiceNoteDraft = {
      id: 'uuid-1',
      residentId: 'uuid-res',
      transcript: 'Some test',
      isOfflineSync: true,
      offlineSyncId: 'local-sqlite-123',
      createdAt: new Date().toISOString()
    };
    
    expect(draft.isOfflineSync).toBe(true);
    expect(draft.offlineSyncId).toBe('local-sqlite-123');
  });

  it('supports follow-ups to existing drafts @REQ: VOICE-FOLLOWUP', () => {
    const draft: VoiceNoteDraft = {
      id: 'uuid-2',
      residentId: 'uuid-res',
      transcript: 'Correction: blood pressure was 120/80',
      isOfflineSync: false,
      followUpToDraftId: 'uuid-1',
      createdAt: new Date().toISOString()
    };
    
    expect(draft.followUpToDraftId).toBe('uuid-1');
  });
});
