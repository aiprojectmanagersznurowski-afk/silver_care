import { test, expect } from '../fixtures/base-test';
import { PageConsistencyPage, type HeaderSnapshot } from '../page-objects/PageConsistencyPage';

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 * @REQ: UI-ACCESSIBILITY
 *
 * ADR-017: spójność ekranów. Każdy widok ma jeden wspólny nagłówek strony (PageHeader)
 * z jedynym h1 na stronie, a tytuł i opis wyglądają tak samo na wszystkich widokach roli.
 * Pulpit rodziny (/dashboard) ma własny nagłówek powitalny i jest poza tym audytem.
 */

const SCREENS: { role: 'org_admin' | 'super_admin' | 'nurse' | 'family'; paths: string[] }[] = [
  { role: 'org_admin', paths: ['/admin', '/admin/residents', '/admin/facility', '/admin/staff', '/admin/invitations', '/admin/messages', '/admin/reports/statistics', '/admin/reports/daily', '/admin/audit', '/settings/profile'] },
  { role: 'super_admin', paths: ['/admin/organizations', '/admin/iam'] },
  { role: 'nurse', paths: ['/staff', '/staff/agenda', '/staff/reports', '/voice'] },
  { role: 'family', paths: ['/agenda', '/messages', '/consents'] },
];

test.describe('Spójność ekranów — wspólny nagłówek strony (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const { role, paths } of SCREENS) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${role}: ${paths.length} widoków z jednym PageHeader i jedną typografią tytułu`, async ({ loginPage, page }) => {
      await loginPage.loginAs(role);
      const screens = new PageConsistencyPage(page);
      const snapshots: Record<string, HeaderSnapshot> = {};

      for (const path of paths) {
        await screens.goto(path);
        snapshots[path] = await screens.headerSnapshot();
      }

      const structural = Object.fromEntries(
        Object.entries(snapshots)
          .filter(([, s]) => s.headers !== 1 || s.h1Total !== 1 || s.h1InHeader !== 1)
          .map(([path, s]) => [path, { headers: s.headers, h1Total: s.h1Total, h1InHeader: s.h1InHeader }]),
      );
      expect(structural, 'widoki bez jednego PageHeader z jedynym h1').toEqual({});

      const titleStyles = new Set(Object.values(snapshots).map((s) => s.titleStyle));
      expect([...titleStyles], 'różna typografia tytułu między widokami').toHaveLength(1);

      const descriptionStyles = new Set(Object.values(snapshots).map((s) => s.descriptionStyle).filter(Boolean));
      expect(descriptionStyles.size, 'różny styl opisu między widokami').toBeLessThanOrEqual(1);
    });
  }
});

test.describe('Cel dotykowy z tokenu kontraktu (@REQ: UI-ACCESSIBILITY)', () => {
  test('@REQ: UI-ACCESSIBILITY - link powrotu w nagłówku ma cel dotykowy 38px (ADR-018)', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const screens = new PageConsistencyPage(page);
    await screens.goto('/settings/profile');
    expect(await screens.backLinkTouchTarget()).toEqual({ minHeight: '38px', minWidth: '0px' });
  });
});

/** Widoki z tabelami (dane demo zawsze zawierają pensjonariuszy, konta i wpisy audytowe). */
const TABLE_SCREENS: { role: 'org_admin' | 'super_admin'; paths: string[] }[] = [
  { role: 'org_admin', paths: ['/admin/staff', '/admin/invitations', '/admin/audit', '/admin/reports/daily'] },
  { role: 'super_admin', paths: ['/admin/iam'] },
];

test.describe('Spójność ekranów — wspólna ramka tabeli (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const { role, paths } of TABLE_SCREENS) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${role}: każda tabela w ramce TableCard o jednym stylu`, async ({ loginPage, page }) => {
      await loginPage.loginAs(role);
      const screens = new PageConsistencyPage(page);
      let tables = 0;
      const outside: Record<string, string[]> = {};
      const frames = new Set<string>();

      for (const path of paths) {
        await screens.goto(path);
        const snap = await screens.tableSnapshot();
        tables += snap.tables;
        if (snap.outsideCard.length) outside[path] = snap.outsideCard;
        snap.frames.forEach((f) => frames.add(f));
      }

      expect(tables, 'brak tabel na widokach tabelarycznych').toBeGreaterThan(0);
      expect(outside, 'tabele poza wspólną ramką TableCard').toEqual({});
      expect([...frames], 'różne style ramek tabel').toHaveLength(1);
    });
  }
});

/** Widoki, na których dane demo zawsze zawierają statusy (pensjonariusze, konta, raporty). */
const BADGE_SCREENS: { role: 'org_admin' | 'super_admin' | 'nurse'; paths: string[] }[] = [
  { role: 'org_admin', paths: ['/admin/residents', '/admin/invitations', '/admin/staff'] },
  { role: 'super_admin', paths: ['/admin/iam'] },
  { role: 'nurse', paths: ['/staff/reports', '/staff/agenda'] },
];

test.describe('Spójność ekranów — wspólna plakietka statusu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const { role, paths } of BADGE_SCREENS) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${role}: statusy mają jeden kształt i najwyżej dwa tony`, async ({ loginPage, page }) => {
      await loginPage.loginAs(role);
      const screens = new PageConsistencyPage(page);
      let count = 0;
      const shapes = new Set<string>();
      const tones = new Set<string>();

      for (const path of paths) {
        await screens.goto(path);
        const snap = await screens.statusBadgeSnapshot();
        count += snap.count;
        snap.shapes.forEach((s) => shapes.add(s));
        snap.tones.forEach((t) => tones.add(t));
      }

      expect(count, 'brak plakietek StatusBadge na widokach ze statusami').toBeGreaterThan(0);
      expect([...shapes], 'różne kształty plakietek statusu').toHaveLength(1);
      expect(tones.size, `więcej niż dwa tony plakietek: ${[...tones].join(', ')}`).toBeLessThanOrEqual(2);
    });
  }
});
