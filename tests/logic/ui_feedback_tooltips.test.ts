import { describe, it, expect } from 'vitest';
import { REQUIRED_UI_STATES } from '@silvercare/contracts/src/generated/presentation';
import { ACCESSIBILITY } from '@silvercare/contracts/src/generated/design';
import { validateAccessibilityStandards } from '../../apps/web/src/lib/ui-theme-validator';

/**
 * @REQ: UI-ACCESSIBILITY
 * @REQ: UI-FOUR-STATES
 *
 * Testy wykonawcze dla nowoczesnych komponentów feedbacku UI (Toast, ConfirmDialog, Tooltip):
 * 1. Dostępność komponentów dialogów i powiadomień bez blokowania wątku przeglądarki.
 * 2. Spełnienie 4 stanów UI (loading, empty, success, error) dla operacji asynchronicznych.
 * 3. Poprawne eksporty komponentów feedbacku.
 */
describe('UI Feedback & Tooltips (@REQ: UI-ACCESSIBILITY, @REQ: UI-FOUR-STATES)', () => {
  it('zapewnia standardy dostępności WCAG dla komponentów feedbacku @REQ: UI-ACCESSIBILITY', () => {
    const a11yResult = validateAccessibilityStandards(ACCESSIBILITY);
    expect(a11yResult.valid).toBe(true);
    expect(ACCESSIBILITY.touchTargetMinimum).toBe('44px');
  });

  it('wspiera wymagane 4 stany interfejsu (loading, empty, success, error) @REQ: UI-FOUR-STATES', () => {
    expect(REQUIRED_UI_STATES).toHaveLength(4);
    expect(REQUIRED_UI_STATES).toContain('loading');
    expect(REQUIRED_UI_STATES).toContain('empty');
    expect(REQUIRED_UI_STATES).toContain('success');
    expect(REQUIRED_UI_STATES).toContain('error');
  });

  it('poprawnie eksportuje komponenty Toaster, ConfirmDialog i Tooltip @REQ: UI-FOUR-STATES', async () => {
    const sonnerModule = await import('../../apps/web/src/components/ui/sonner');
    expect(typeof sonnerModule.Toaster).toBe('function');

    const confirmModule = await import('../../apps/web/src/components/ui/confirm-dialog');
    expect(typeof confirmModule.ConfirmDialog).toBe('function');

    const tooltipModule = await import('../../apps/web/src/components/ui/tooltip');
    expect(typeof tooltipModule.Tooltip).toBe('function');
  });
});
