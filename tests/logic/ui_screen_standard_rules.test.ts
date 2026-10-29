import { describe, it, expect } from 'vitest';
import { checkWrite, kkConfig } from '../../tools/guard-core.mjs';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * ADR-017: ekran składa się ze wspólnych komponentów (PageHeader, StatusBadge, TableCard),
 * a lista z przełącznikiem widoku startuje od tabeli (decyzja Michała z audytu UI).
 * Te same reguły działają w hookach agentów i w CI (verify.sh krok 6).
 */
const COMPONENT = 'apps/web/src/components/Example.tsx';
const RULES = ['ui-default-view-table', 'ui-own-page-heading', 'ui-own-status-badge', 'ui-own-table-frame'];

describe('Reguły standardu ekranu (ADR-017)', () => {
  it('@REQ: UI-TEMPLATE-ALIGNMENT - reguły istnieją w sc.config i są blokujące', () => {
    for (const id of RULES) {
      const rule = kkConfig.forbiddenPatterns.find((p: { id: string }) => p.id === id);
      expect(rule, id).toBeDefined();
      expect(rule.severity, id).not.toBe('warn');
    }
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - lista z przełącznikiem widoku startuje od tabeli', () => {
    const grid = "const [v, setV] = useViewPreference(VIEW_PREFERENCE_KEYS.beds, 'grid', ['table', 'grid'] as const)";
    const roundsMultiline = "useViewPreference(\n    VIEW_PREFERENCE_KEYS.staffBoard,\n    'rounds',\n    ['table', 'rounds'] as const\n  )";
    expect(checkWrite(COMPONENT, grid).rule).toBe('ui-default-view-table');
    expect(checkWrite(COMPONENT, roundsMultiline).rule).toBe('ui-default-view-table');

    const table = "useViewPreference(VIEW_PREFERENCE_KEYS.beds, 'table', ['table', 'grid'] as const)";
    const tableMultiline = "useViewPreference(\n    VIEW_PREFERENCE_KEYS.residents,\n    'table',\n    ['table', 'grid'] as const\n  )";
    expect(checkWrite(COMPONENT, table).blocked).toBe(false);
    expect(checkWrite(COMPONENT, tableMultiline).blocked).toBe(false);
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - h1 strony wyłącznie przez PageHeader', () => {
    expect(checkWrite(COMPONENT, '<h1 className="text-2xl">Podopieczni</h1>').rule).toBe('ui-own-page-heading');
    expect(checkWrite('apps/web/src/components/patterns/PageHeader.tsx', '<h1 className="x">{title}</h1>').blocked).toBe(false);
    expect(checkWrite('apps/web/src/app/login/page.tsx', '<h1 className="x">Zaloguj</h1>').blocked).toBe(false);
    expect(checkWrite(COMPONENT, '<h2 className="text-lg">Sekcja</h2>').blocked).toBe(false);
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - plakietka statusu wyłącznie przez StatusBadge', () => {
    const rawBadge = "import { Badge } from '@/components/ui/badge'";
    expect(checkWrite(COMPONENT, rawBadge).rule).toBe('ui-own-status-badge');
    expect(checkWrite('apps/web/src/components/patterns/StatusBadge.tsx', rawBadge).blocked).toBe(false);
    expect(checkWrite(COMPONENT, "import { StatusBadge } from '@/components/patterns/StatusBadge'").blocked).toBe(false);
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - tabela wyłącznie w ramie TableCard (sprawdzenie całego pliku)', () => {
    const rawTable = "import { Table, TableBody } from '@/components/ui/table'\nexport function X() { return <Table><TableBody /></Table> }";
    const framed = "import { TableCard } from '@/components/patterns/TableCard'\nimport { TableBody } from '@/components/ui/table'\nexport function X() { return <TableCard><TableBody /></TableCard> }";
    expect(checkWrite(COMPONENT, rawTable, { wholeFile: true }).rule).toBe('ui-own-table-frame');
    expect(checkWrite(COMPONENT, framed, { wholeFile: true }).blocked).toBe(false);
    // hook widzi tylko fragment edycji — reguła całego pliku nie może blokować pojedynczego importu
    expect(checkWrite(COMPONENT, "import { TableBody } from '@/components/ui/table'").blocked).toBe(false);
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - nie dotyczy testów ani komponentów ui', () => {
    expect(checkWrite('e2e/roles/example.spec.ts', '<h1>x</h1>').blocked).toBe(false);
    expect(checkWrite('apps/web/src/components/ui/card.tsx', "import { Badge } from '@/components/ui/badge'").blocked).toBe(false);
  });
});
