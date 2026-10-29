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

  it('@REQ: UI-TEMPLATE-ALIGNMENT - domyślny widok musi być literałem table, nie zmienną', () => {
    expect(checkWrite(COMPONENT, 'useViewPreference(VIEW_PREFERENCE_KEYS.beds, defaultMode, MODES)').rule).toBe('ui-default-view-table');
    expect(checkWrite(COMPONENT, "useViewPreference(KEY,'table', ['table', 'grid'] as const)").blocked).toBe(false);
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - lista kart ma widok tabeli (ListViewFrame albo useViewPreference w pliku)', () => {
    const cardsOnly = "export function L({ items }) { return <div>{items.map((i) => <ObjectCard key={i.id} title={i.name} />)}</div> }";
    const withFrame = "import { ListViewFrame } from '@/components/patterns/ListViewFrame'\n" + cardsOnly.replace('<div>', '<ListViewFrame>');
    expect(checkWrite(COMPONENT, cardsOnly, { wholeFile: true }).rule).toBe('ui-list-needs-table-view');
    expect(checkWrite(COMPONENT, withFrame, { wholeFile: true }).blocked).toBe(false);
    expect(checkWrite(COMPONENT, cardsOnly).blocked).toBe(false);
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - komórki tabeli bez własnej wysokości, odstępów pionowych i rozmiaru tekstu', () => {
    for (const cls of ['py-4', 'h-12', 'text-sm text-muted-foreground', 'p-4 pt-1', 'leading-tight']) {
      expect(checkWrite(COMPONENT, `<TableCell className="${cls}">x</TableCell>`).rule, cls).toBe('ui-table-cell-size');
    }
    expect(checkWrite(COMPONENT, '<TableHead className="px-2 py-3 text-center">x</TableHead>').rule).toBe('ui-table-cell-size');
    for (const cls of ['font-medium', 'text-right', 'text-muted-foreground whitespace-nowrap', 'w-[120px] px-4']) {
      expect(checkWrite(COMPONENT, `<TableCell className="${cls}">x</TableCell>`).blocked, cls).toBe(false);
    }
  });

  it('@REQ: UI-TEMPLATE-ALIGNMENT - lista wyjątków (dług z 2026-10-29) może tylko maleć', () => {
    const BASELINE: Record<string, string[]> = {
      'ui-own-page-heading': ['components/patterns/', 'components/ui/', 'app/login/', 'app/unauthorized/', 'components/FamilyDashboardClient.tsx', 'components/residents/profile/ResidentProfileHeader.tsx'],
      'ui-own-status-badge': ['components/patterns/', 'components/ui/', 'components/AdminSidebar.tsx', 'components/StaffSidebar.tsx', 'components/StaffNotificationBell.tsx', 'components/ResidentInlineCareLevel.tsx', 'components/admission/AdmissionStepBed.tsx', 'components/profile/ProfileSessionsCard.tsx', 'components/residents/profile/ResidentGeneralInfoCard.tsx', 'components/search/CommandPaletteResults.tsx'],
      'ui-own-table-frame': ['components/patterns/', 'components/ui/', 'components/facility/RoomTableView.tsx', 'components/residents/ResidentsTable.tsx'],
      'ui-list-needs-table-view': ['components/patterns/', 'components/ui/', 'components/reports/DailyReportGrid.tsx'],
      'ui-table-cell-size': ['components/patterns/', 'components/ui/', 'components/InvitationsTable.tsx', 'components/facility/BedTableRow.tsx', 'components/facility/RoomTableView.tsx', 'components/reports/DailyReportTable.tsx'],
      'ui-default-view-table': [],
    };
    for (const [id, allowed] of Object.entries(BASELINE)) {
      const rule = kkConfig.forbiddenPatterns.find((p: { id: string }) => p.id === id);
      expect(rule, id).toBeDefined();
      for (const entry of rule.allowIn || []) expect(allowed, `${id}: nowy wyjątek „${entry}”`).toContain(entry);
    }
  });
});
