import { describe, it, expect } from 'vitest';
import { checkWrite, kkConfig } from '../../tools/guard-core.mjs';
import { UI_TERMINOLOGY } from '../../packages/contracts/src/generated/presentation';

/**
 * @REQ: UI-TERMINOLOGY
 *
 * NFR-UI-06: ta sama rzecz nazywa się w UI tak samo (słownik UI_TERMINOLOGY w kontrakcie).
 * Reguła bramki ui-terminology działa w hookach agentów i w verify.sh krok 6.
 * Terminy formalOnly (pensjonariusz) są dozwolone wyłącznie w dokumentach RODO (zgody).
 */
const COMPONENT = 'apps/web/src/components/Example.tsx';

describe('Reguła terminologii UI (UI-TERMINOLOGY)', () => {
  it('@REQ: UI-TERMINOLOGY - reguła istnieje i jest blokująca', () => {
    const rule = kkConfig.forbiddenPatterns.find((p: { id: string }) => p.id === 'ui-terminology');
    expect(rule).toBeDefined();
    expect(rule.severity).not.toBe('warn');
  });

  it('@REQ: UI-TERMINOLOGY - każdy zakazany synonim ze słownika jest blokowany', () => {
    for (const entry of UI_TERMINOLOGY) {
      for (const term of entry.forbidden) {
        for (const variant of [term, term.charAt(0).toUpperCase() + term.slice(1)]) {
          const res = checkWrite(COMPONENT, `<p>To jest ${variant} w tekście.</p>`);
          expect(res.rule, variant).toBe('ui-terminology');
        }
      }
    }
  });

  it('@REQ: UI-TERMINOLOGY - odmiany i tytuły pisane wielkimi literami', () => {
    for (const text of ['Struktura ośrodka', 'Rejestr ośrodków', 'Administrator Ośrodka', 'wymagana rola administratora placówki',
      'skontaktuj się z administratorem placówki', 'Zarządzanie Placówkami', 'Struktura Placówki', 'Kierownik Placówki', 'pojemność placówki']) {
      expect(checkWrite(COMPONENT, `const t = '${text}'`).rule, text).toBe('ui-terminology');
    }
  });

  it('@REQ: UI-TERMINOLOGY - dozwolone: terminy ze słownika, Administrator platformy, zdanie zaczynające się od „Placówka”', () => {
    for (const text of ['Struktura placówki', 'Kierownik placówki', 'Administrator platformy', 'Zarządzanie placówkami',
      'Placówka została utworzona.', 'limit miejsc placówki', 'podopieczny']) {
      expect(checkWrite(COMPONENT, `const t = '${text}'`).blocked, text).toBe(false);
    }
  });

  it('@REQ: UI-TERMINOLOGY - „pensjonariusz” (formalOnly) zakazany w UI, dozwolony tylko w dokumentach RODO', () => {
    for (const text of ['Dodaj pensjonariusza', 'Pensjonariusz został wypisany', 'Lista pensjonariuszy', 'z przypisanym pensjonariuszem', 'Pensjonariusze placówki', 'limit pensjonariuszy']) {
      expect(checkWrite(COMPONENT, `const t = '${text}'`).rule, text).toBe('ui-terminology');
    }
    for (const formal of ['apps/web/src/app/(family)/consents/page.tsx', 'apps/web/src/components/auth/RegisterConsentsSection.tsx']) {
      expect(checkWrite(formal, "const t = 'opiekunem prawnym pensjonariusza'").blocked, formal).toBe(false);
    }
  });

  it('@REQ: UI-TERMINOLOGY - nie dotyczy testów i dokumentacji', () => {
    expect(checkWrite('e2e/roles/example.spec.ts', "const t = 'Struktura ośrodka'").blocked).toBe(false);
    expect(checkWrite('docs/MASTER_DATA_STANDARD.md', 'ośrodek').blocked).toBe(false);
  });
});
