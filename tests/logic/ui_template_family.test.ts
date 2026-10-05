import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-PHYSIO-TO-FAMILY
 *
 * PR 4/4 (ADR-011, ADR-014): reszta aplikacji (portal bliskich, uwierzytelnianie, profil
 * i pozostałości w panelach) na tokenach szablonu. Po tym PR żaden widok nie używa
 * palety portalu (sage/cream/slate), kolorów Tailwinda, gradientów ani kolorów na sztywno.
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

// Cała aplikacja poza komponentami bazowymi szablonu (components/ui żyje według własnych zasad)
const APP_FILES = [...scan(path.join(WEB, 'app')), ...scan(path.join(WEB, 'components'))].filter(
  (f) => !f.includes(`${path.sep}components${path.sep}ui${path.sep}`),
);

const violations = (re: RegExp, files = APP_FILES) =>
  files.flatMap((f) => {
    const src = fs.readFileSync(f, 'utf-8');
    return [...src.matchAll(re)].map((m) => `${path.relative(WEB, f)}:${src.slice(0, m.index).split('\n').length}`);
  });

describe('Cała aplikacja na tokenach szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('obejmuje wszystkie widoki i komponenty @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(APP_FILES.length).toBeGreaterThanOrEqual(110);
  });

  it('żaden widok nie używa palety portalu sage/cream/slate @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(
      violations(/\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|selection|placeholder|shadow|accent|caret)-(?:sage|cream|slate)(?:-[a-z]+)?\b/g),
    ).toEqual([]);
  });

  it('żaden widok nie używa kolorów palety Tailwinda @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(
      violations(/\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|decoration|accent)-(?:red|rose|green|emerald|lime|teal|amber|orange|yellow|blue|sky|indigo|violet|purple|pink|cyan|fuchsia|gray|zinc|neutral|stone)-\d+/g),
    ).toEqual([]);
  });

  it('brak kolorów wpisanych na sztywno (hex, rgb, hsl) @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(violations(/#[0-9a-fA-F]{6}\b|\brgba?\(\s*\d|\bhsla?\(\s*\d/g)).toEqual([]);
  });

  it('brak gradientów (ADR-011: bez ozdobnych gradientów) @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(violations(/\b(?:bg|from|via|to)-gradient|\b(?:linear|radial|conic)-gradient\(/g)).toEqual([]);
  });

  it('karty bez cienia i bez zaokrągleń spoza szablonu @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(violations(/\bshadow-(?:sm|md|xs)\b|\brounded-(?:2xl|3xl)\b/g)).toEqual([]);
  });

  it('listy wyboru, pola wieloliniowe i tabele z components/ui w całej aplikacji @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(violations(/<(?:select|textarea|table)\b/g)).toEqual([]);
  });

  it('wylogowanie nie jest czerwone — czerwień tylko dla błędów i akcji destrukcyjnych @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const src = fs.readFileSync(path.join(WEB, 'components/SidebarAccount.tsx'), 'utf-8');
    expect(src).not.toMatch(/destructive/);
  });
});

describe('Portal bliskich bez wykresów (@REQ: MDR-NO-PHYSIO-TO-FAMILY)', () => {
  const FAMILY_FILES = [
    ...scan(path.join(WEB, 'app/(family)')),
    ...['FamilyDashboardClient', 'FamilyHeader', 'FamilyMessageForm', 'DailySummaryHero', 'DailyReportViewer', 'HealthRingInsight',
      'ActivityRings', 'PolarWearableCard', 'ServiceActivityFeed', 'ResidentMessagesHistory', 'CommunicationWidget',
      'PhotoGalleryModal', 'ResidentSwitcher', 'GlobalResidentSwitcher', 'OnboardingModal', 'AgendaTimelineClient']
      .map((n) => path.join(WEB, `components/${n}.tsx`)),
  ].filter((f) => fs.existsSync(f));

  it('żaden widok bliskich nie importuje wykresów (ui/chart, recharts) @REQ: MDR-NO-PHYSIO-TO-FAMILY', () => {
    expect(FAMILY_FILES.length).toBeGreaterThanOrEqual(15);
    expect(violations(/@\/components\/ui\/chart|from ['"]recharts['"]/g, FAMILY_FILES)).toEqual([]);
  });
});
