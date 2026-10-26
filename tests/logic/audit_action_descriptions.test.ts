import { describe, it, expect } from 'vitest'
import { AUDIT_ACTION_DESCRIPTIONS, AUDIT_TONE_CLASS } from '../../apps/web/src/components/iam/audit-action-descriptions'

/**
 * @REQ: SUP-IAM-PANEL
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * Rejestr zmian uprawnień opisuje zdarzenia jako fakty. Czerwień jest zarezerwowana dla błędów technicznych,
 * więc żaden wpis audytu — także „Trwałe usunięcie konta” — nie jest czerwony (decyzja Michała 2026-10-26).
 */
describe('Opisy zdarzeń w rejestrze audytu (@REQ: SUP-IAM-PANEL)', () => {
  it('@REQ: SUP-IAM-PANEL - znane zdarzenia mają opis po polsku', () => {
    expect(AUDIT_ACTION_DESCRIPTIONS.password_reset.text).toBe('Reset i aktualizacja hasła konta')
    expect(AUDIT_ACTION_DESCRIPTIONS.USER_DEACTIVATED.text).toBe('Blokada konta (deaktywacja)')
    expect(AUDIT_ACTION_DESCRIPTIONS.USER_ACTIVATED.text).toBe('Odblokowanie konta (reaktywacja)')
    expect(AUDIT_ACTION_DESCRIPTIONS.USER_HARD_DELETED.text).toBe('Trwałe usunięcie konta z bazy')
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - żaden opis nie używa czerwieni', () => {
    for (const [action, d] of Object.entries(AUDIT_ACTION_DESCRIPTIONS)) {
      expect(AUDIT_TONE_CLASS[d.tone], action).not.toMatch(/destructive|red/)
    }
  })
})
