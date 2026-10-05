import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { TYPOGRAPHY, ACCESSIBILITY, COLORS } from '../../contracts/design.contract.mjs';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: MDR-NO-PHYSIO-TO-FAMILY
 *
 * ADR-014: komponenty i układ szablonu shadcn-admin (styl nova) w skali 14px/32px,
 * tokeny generowane z kontraktu zamiast wartości wpisanych ręcznie.
 */

const ROOT = path.resolve(__dirname, '../..');
const WEB = path.join(ROOT, 'apps/web/src');
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), 'utf-8');

function scan(dir: string, ext: string[]): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return scan(p, ext);
    return ext.some((x) => e.name.endsWith(x)) ? [p] : [];
  });
}

describe('Tokeny z kontraktu w motywie aplikacji (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  const globals = read('apps/web/src/app/globals.css');

  it('kontrakt ma skalę szablonu: tekst 14px, cel dotykowy 32px @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(TYPOGRAPHY.baseSize).toBe('14px');
    expect(ACCESSIBILITY.touchTargetMinimum).toBe('32px');
  });

  it('globals.css importuje wygenerowany tokens.css @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(globals).toMatch(/@import\s+["'][^"']*packages\/contracts\/src\/generated\/tokens\.css["']/);
  });

  it('globals.css nie zawiera wartości kolorów wpisanych ręcznie @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const literals = globals.match(/#[0-9a-fA-F]{3,8}\b|oklch\(|rgba?\(|hsla?\(/g) ?? [];
    expect(literals).toEqual([]);
  });

  it('zmienne motywu shadcn wskazują tokeny --sc-* @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const mapping: Record<string, string> = {
      '--background': '--sc-bg',
      '--foreground': '--sc-text',
      '--card': '--sc-surface',
      '--primary': '--sc-accent',
      '--primary-foreground': '--sc-accent-foreground',
      '--muted': '--sc-surface-sunken',
      '--muted-foreground': '--sc-text-secondary',
      '--accent': '--sc-accent-soft',
      '--destructive': '--sc-destructive',
      '--border': '--sc-border',
      '--input': '--sc-input',
      '--ring': '--sc-focus',
      '--sidebar': '--sc-sidebar',
      '--sidebar-accent': '--sc-sidebar-accent',
      '--chart-1': '--sc-chart-1',
      '--chart-5': '--sc-chart-5',
      '--sage': '--sc-portal-primary',
      '--slate': '--sc-portal-ink',
      '--cream': '--sc-portal-surface',
      '--radius': '--sc-radius-lg',
    };
    for (const [shadcnVar, token] of Object.entries(mapping)) {
      expect(globals, `${shadcnVar} → var(${token})`).toMatch(new RegExp(`${shadcnVar}:\\s*var\\(${token}\\)`));
    }
  });

  it('tekst bazowy dokumentu pochodzi z tokenu kontraktu @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    expect(globals).toMatch(/font-size:\s*var\(--sc-text-base-size\)/);
  });

  it('każdy token koloru użyty w globals.css istnieje w kontrakcie @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const used = [...globals.matchAll(/var\(--sc-([a-z0-9-]+)\)/g)].map((m) => m[1]);
    const nonColor = /^(font-|text-|space-|radius-|shadow-|ease|duration-|touch-)/;
    for (const tok of used.filter((t) => !nonColor.test(t))) {
      expect(COLORS.light, `brak tokenu ${tok} w kontrakcie`).toHaveProperty(tok);
    }
  });
});

describe('Komponenty bazowe szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  const required = [
    'sidebar', 'table', 'tabs', 'select', 'field', 'empty', 'chart', 'scroll-area', 'collapsible',
    'popover', 'progress', 'pagination', 'toggle-group', 'input-group', 'alert', 'kbd', 'textarea', 'switch',
  ];

  it.each(required)('components/ui/%s.tsx istnieje @REQ: UI-TEMPLATE-ALIGNMENT', (name) => {
    expect(fs.existsSync(path.join(WEB, `components/ui/${name}.tsx`))).toBe(true);
  });

  it('komponenty ui używają Base UI (styl base-nova), bez mieszania z Radix @REQ: UI-TEMPLATE-ALIGNMENT', () => {
    const radix = scan(path.join(WEB, 'components/ui'), ['.tsx'])
      .filter((f) => /from ["'](radix-ui|@radix-ui\/[^"']+)["']/.test(fs.readFileSync(f, 'utf-8')))
      .map((f) => path.basename(f));
    expect(radix).toEqual([]);
  });
});

describe('Zwijany pasek boczny szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  it.each([
    ['apps/web/src/app/(admin)/layout.tsx'],
    ['apps/web/src/app/(staff)/layout.tsx'],
  ])('%s używa SidebarProvider, SidebarInset i SidebarTrigger @REQ: UI-TEMPLATE-ALIGNMENT', (file) => {
    const src = read(file);
    expect(src).toContain('<SidebarProvider');
    expect(src).toContain('<SidebarInset');
    expect(src).toContain('<SidebarTrigger');
  });

  it.each([
    ['apps/web/src/components/AdminSidebar.tsx'],
    ['apps/web/src/components/StaffSidebar.tsx'],
  ])('%s jest zbudowany na <Sidebar collapsible="icon"> @REQ: UI-TEMPLATE-ALIGNMENT', (file) => {
    const src = read(file);
    expect(src).toMatch(/<Sidebar\b[^>]*collapsible="icon"/);
    expect(src).toContain('<SidebarMenuButton');
  });
});

describe('Kolory wykresów nie prezentują metryk pensjonariusza (@REQ: MDR-NO-PHYSIO-TO-FAMILY)', () => {
  it('ui/chart importowany wyłącznie w statystykach placówki panelu administratora @REQ: MDR-NO-PHYSIO-TO-FAMILY', () => {
    const allowed = [
      'app/(admin)/admin/reports/statistics/page.tsx',
      'components/StatisticsDashboardClient.tsx',
    ];
    const importers = scan(WEB, ['.tsx', '.ts'])
      .filter((f) => !f.includes(`${path.sep}components${path.sep}ui${path.sep}`))
      .filter((f) => /@\/components\/ui\/chart["']/.test(fs.readFileSync(f, 'utf-8')))
      .map((f) => path.relative(WEB, f));
    expect(importers.filter((f) => !allowed.includes(f))).toEqual([]);
  });
});
