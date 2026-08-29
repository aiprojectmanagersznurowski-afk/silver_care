export interface VoiceNoteDraft {
  id: string;
  residentId: string;
  transcript: string;
  
  // SEC-OFFLINE & VOICE-OFFLINE support
  offlineSyncId?: string;
  isOfflineSync: boolean;

  // VOICE-FOLLOWUP support
  followUpToDraftId?: string;
  
  createdAt: string;
}
