// FAM-* requirements support
import { UIState, AccessibleComponent } from './core';

export interface FamilyOnboardingFlow {
  step: 'consent' | 'profile' | 'complete';
  isCompleted: boolean;
}

export interface FamilyDashboard {
  state: UIState;
  // FAM-MULTI-RESIDENT: Array of residents to support one-to-many relationship
  accessibleResidents: Array<{ id: string; name: string }>;
  agenda: Array<any>; // FAM-AGENDA
  messages: Array<any>; // FAM-MESSAGES
}
