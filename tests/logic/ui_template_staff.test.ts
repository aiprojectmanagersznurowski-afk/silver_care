import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-INTERPRETATION
 *
 * PR 3/4 (ADR-014): panel personelu na komponentach i tokenach szablonu shadcn-admin.
 * Jeden akcent (zieleń marki z kontraktu), kolory statusów bez oceny, przełącznik widoku z szablonu.
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

const STAFF_COMPONENTS = [
  'StaffBoardClient', 'StaffMessagesInbox', 'StaffCommandPalette', 'BulkReportApprover', 'AgendaView',
  'AgendaTimeline', 'AgendaTimelineClient', 'ReportCard', 'ResidentZsnCheckbox', 'AdminMessagesInbox', 'ResidentMobileCard',
].map((n) => path.join(WEB, `components/${n}.tsx`));

const STAFF_FILES = [...scan(path.join(WEB, 'app/(staff)')), ...STAFF_COMPONENTS].filter((f) => fs.existsSync(f));

const violations = (re: RegExp) =>
  STAFF_FILES.flatMap((f) => {
    const src = fs.readFileSync(f, 'utf-8');
    return [...src.matchAll(re)].map((m) => `${path.relative(WEB, f)}:${src.slice(0, m.index).split('\n').length}`);
  });

describe('Panel personelu: tokeny szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it('obejmuje widoki i komponenty panelu @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(STAFF_FILES.length).toBeGreaterThanOrEqual(18);
  });

  it('akcent to zieleń marki (primary), nie granat portalu bliskich (sage/cream) @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(violations(/\b(?:bg|text|border|ring|from|to|via|fill|stroke|divide|outline|selection)-(?:sage|cream)(?:-[a-z]+)?\b/g)).toEqual([]);
  });

  it('tekst, tła i obramowania z tokenów motywu, bez klas slate @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(violations(/\b(?:bg|text|border|ring|divide|fill|stroke|placeholder|from|to)-slate(?:-soft)?\b/g)).toEqual([]);
  });

  it('karty bez cienia i bez zaokrągleń spoza szablonu @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(violations(/\bshadow-(?:sm|md|xs)\b|\brounded-(?:2xl|3xl)\b/g)).toEqual([]);
  });

  it('listy wyboru, pola wieloliniowe i tabele z components/ui @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(violations(/<(?:select|textarea|table)\b/g)).toEqual([]);
  });

  it('przełącznik widoku tablicy to ToggleGroup z szablonu @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const board = fs.readFileSync(path.join(WEB, 'components/StaffBoardClient.tsx'), 'utf-8');
    expect(board).toContain("@/components/ui/toggle-group");
    expect(board).toContain('<ToggleGroup');
  });
});

describe('Kolor nie niesie oceny w panelu personelu (@REQ: MDR-NO-INTERPRETATION)', () => {
  it('żadnych kolorów palety Tailwinda (czerwień, zieleń, bursztyn, błękit) w statusach @REQ: MDR-NO-INTERPRETATION', () => {
    expect(
      violations(/\b(?:bg|text|border|ring|from|to|fill|stroke|divide|shadow)-(?:red|rose|green|emerald|lime|teal|amber|orange|yellow|blue|sky|indigo|violet|purple|pink|cyan)-\d+/g),
    ).toEqual([]);
  });

  it('błędy techniczne używają tokenu destructive @REQ: MDR-NO-INTERPRETATION', () => {
    const errorLike = [
      'app/(staff)/voice/page.tsx',
      'components/BulkReportApprover.tsx',
      'components/AgendaTimeline.tsx',
      'components/AdminMessagesInbox.tsx',
    ];
    for (const rel of errorLike) {
      const src = fs.readFileSync(path.join(WEB, rel), 'utf-8');
      expect(src, rel).toContain('text-destructive');
    }
  });

  it('status „Brak wpisu" i brak łóżka są neutralne, bez czerwieni @REQ: MDR-NO-INTERPRETATION', () => {
    const board = fs.readFileSync(path.join(WEB, 'components/StaffBoardClient.tsx'), 'utf-8');
    expect(board).not.toMatch(/Brak wpisu[^\n]*(destructive|rose|red)/);
    expect(board).not.toMatch(/(destructive|rose-|red-)[^\n]*Brak przypisanego łóżka/);
  });
});
