import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-INTERPRETATION
 *
 * PR 2/4 (ADR-014): panel administratora na komponentach szablonu shadcn-admin.
 * Tabele, listy wyboru i pola tekstowe z components/ui, karty bez cienia,
 * statystyki placówki na ui/chart, czerwień wyłącznie dla błędów technicznych.
 */

const ROOT = path.resolve(__dirname, '../..');
const WEB = path.join(ROOT, 'apps/web/src');

function scan(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return scan(p);
    return e.name.endsWith('.tsx') ? [p] : [];
  });
}

const ADMIN_COMPONENTS = [
  'AddResidentDialog', 'AdminInviteActions', 'AdmissionWizard', 'AuditManagementClient', 'BulkImportDialog',
  'BusinessIdBadge', 'CreateOrganizationDialog', 'DailyReportClient', 'EditOrganizationDialog', 'ExportDataDialog',
  'IamManagementClient', 'ImpersonationBanner', 'InviteFamilyDialog', 'InviteStaffDialog', 'ManageResidentBedDialog',
  'OrganizationsManagementClient', 'ResidentEditSheet', 'ResidentInlineCareLevel', 'ResidentMobileCard',
  'ResidentZsnCheckbox', 'StaffActionsMenu', 'StatisticsDashboardClient',
].map((n) => path.join(WEB, `components/${n}.tsx`));

const ADMIN_FILES = [
  ...scan(path.join(WEB, 'app/(admin)')),
  ...scan(path.join(WEB, 'components/facility')),
  ...scan(path.join(WEB, 'components/iam')),
  ...ADMIN_COMPONENTS,
].filter((f) => fs.existsSync(f));

const rel = (f: string) => path.relative(WEB, f);
const violations = (re: RegExp) =>
  ADMIN_FILES.flatMap((f) => {
    const src = fs.readFileSync(f, 'utf-8');
    return [...src.matchAll(re)].map((m) => `${rel(f)}:${src.slice(0, m.index).split('\n').length}`);
  });

describe('Panel administratora na komponentach szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('obejmuje wszystkie widoki i komponenty panelu @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(ADMIN_FILES.length).toBeGreaterThanOrEqual(35);
  });

  it('tabele używają ui/table, nie surowego <table> @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(violations(/<table\b/g)).toEqual([]);
  });

  it('listy wyboru używają NativeSelect, nie surowego <select> @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(violations(/<select\b/g)).toEqual([]);
  });

  it('pola wieloliniowe używają ui/textarea, nie surowego <textarea> @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(violations(/<textarea\b/g)).toEqual([]);
  });

  it('karty bez cienia i bez zaokrągleń spoza szablonu (obwódka zamiast cienia) @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(violations(/\bshadow-(sm|md|xs)\b|\brounded-(2xl|3xl)\b/g)).toEqual([]);
  });

  it('komponenty ui potrzebne panelowi istnieją @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    for (const name of ['table', 'native-select', 'textarea', 'chart', 'empty']) {
      expect(fs.existsSync(path.join(WEB, `components/ui/${name}.tsx`)), name).toBe(true);
    }
  });
});

describe('Statystyki placówki na ui/chart (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  const stats = fs.readFileSync(path.join(WEB, 'components/StatisticsDashboardClient.tsx'), 'utf-8');

  it('używają ChartContainer z szablonu zamiast Nivo @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(stats).toContain('@/components/ui/chart');
    expect(stats).toContain('<ChartContainer');
    expect(stats).not.toContain('@nivo');
  });

  it('kolory serii pochodzą z tokenów chart-*, nie z kolorów oceny @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(stats).toMatch(/var\(--chart-[1-5]\)/);
    expect(stats).not.toMatch(/destructive|hsl\(0,/);
  });

  it('zależności Nivo usunięte z package.json @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const pkg = fs.readFileSync(path.join(ROOT, 'apps/web/package.json'), 'utf-8');
    expect(pkg).not.toContain('@nivo');
  });
});

describe('Czerwień nie niesie oceny stanu pensjonariusza (@REQ: MDR-NO-INTERPRETATION)', () => {
  const constants = fs.readFileSync(path.join(WEB, 'lib/reporting-constants.ts'), 'utf-8');
  const careLevelBlocks = constants.match(/export (?:const CARE_LEVEL_[A-Z_]+|function getCareLevelChartColors)[\s\S]*?\n}\n/g) ?? [];

  it('stany opieki (w tym „Leżący") nie mają koloru destructive ani czerwonego @REQ: MDR-NO-INTERPRETATION', () => {
    expect(careLevelBlocks.length).toBeGreaterThanOrEqual(3);
    for (const block of careLevelBlocks) {
      expect(block).not.toMatch(/destructive|hsl\(0,|red-|rose-/);
    }
  });

  it('badge i kropki stanu opieki na liście podopiecznych nie używają czerwieni @REQ: MDR-NO-INTERPRETATION', () => {
    const src = fs.readFileSync(path.join(WEB, 'components/ResidentInlineCareLevel.tsx'), 'utf-8');
    // Komunikat błędu technicznego (zapis nie powiódł się) może być czerwony — kolor stanu opieki nie.
    const levelColorLines = src.split('\n').filter((l) => /CARE_LEVEL_(BG_CLASSES|COLORS)/.test(l) && !/^import|^\s+CARE_LEVEL/.test(l));
    expect(levelColorLines.length).toBeGreaterThan(0);
    for (const line of levelColorLines) expect(line).not.toMatch(/destructive|red-\d|rose-\d/);
    expect(src).not.toMatch(/bedridden[^\n]*(red|rose|destructive)/);
  });
});
