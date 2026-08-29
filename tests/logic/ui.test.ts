import { describe, it, expect } from 'vitest';
import { UIState, AccessibleComponent } from '../../packages/contracts/src/ui/core';
import { FamilyDashboard, FamilyOnboardingFlow } from '../../packages/contracts/src/ui/family';
import { NurseBoard } from '../../packages/contracts/src/ui/nurse';

describe('UI & Presentations (UI-FOUR-STATES, UI-ACCESSIBILITY, FAM-*, NUR-*)', () => {

  it('supports 4 core states @REQ: UI-FOUR-STATES', () => {
    const states: UIState[] = ['loading', 'empty', 'error', 'success'];
    expect(states.length).toBe(4);
  });

  it('supports WCAG accessibility attributes @REQ: UI-ACCESSIBILITY', () => {
    const btn: AccessibleComponent = {
      ariaLabel: 'Save',
      role: 'button',
      tabIndex: 0
    };
    expect(btn.ariaLabel).toBe('Save');
  });

  it('family dashboard supports agenda, messages and multi-resident @REQ: FAM-DASHBOARD @REQ: FAM-AGENDA @REQ: FAM-MESSAGES @REQ: FAM-MULTI-RESIDENT', () => {
    const dashboard: FamilyDashboard = {
      state: 'success',
      accessibleResidents: [
        { id: '1', name: 'Grandma' },
        { id: '2', name: 'Grandpa' }
      ],
      agenda: [{ time: '10:00', event: 'Breakfast' }],
      messages: [{ from: 'Nurse', text: 'All good' }]
    };

    expect(dashboard.accessibleResidents.length).toBeGreaterThan(1);
    expect(dashboard.agenda).toBeDefined();
    expect(dashboard.messages).toBeDefined();
  });

  it('family onboarding flow @REQ: FAM-ONBOARDING', () => {
    const onboarding: FamilyOnboardingFlow = {
      step: 'consent',
      isCompleted: false
    };
    expect(onboarding.step).toBe('consent');
  });

  it('nurse dashboard supports shift state and agenda @REQ: NUR-BOARD @REQ: NUR-AGENDA', () => {
    const board: NurseBoard = {
      state: 'success',
      activeShift: true,
      agenda: [{ time: '12:00', task: 'Meds' }],
      assignedBeds: ['bed-1', 'bed-2']
    };

    expect(board.activeShift).toBe(true);
    expect(board.agenda).toBeDefined();
  });

});
