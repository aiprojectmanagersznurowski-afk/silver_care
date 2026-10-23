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

test.describe('Paleta szablonu: neutralne tła, cień kart, marka tylko jako akcent (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - jasny motyw: białe tło, karty z cieniem, podświetlenie menu bez koloru marki (ADR-019)', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    await page.evaluate(() => window.localStorage.setItem('sc-theme', 'light'));
    const screens = new PageConsistencyPage(page);
    await screens.goto('/admin');
    const snap = await screens.surfaceSnapshot();
    expect(snap.bodyBg).toBe('rgb(255, 255, 255)');
    // ring-1 też jest box-shadow, więc sprawdzamy konkretnie warstwę shadow-xs: 0 1px 2px
    expect(snap.cardShadow ?? '').toContain('0px 1px 2px 0px');
    expect(snap.accentForeground).toBe(snap.foreground);
  });

  test('@REQ: UI-TEMPLATE-ALIGNMENT - skala tekstu szablonu: treść 14px, opis nagłówka 14px (ADR-020)', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const screens = new PageConsistencyPage(page);
    await screens.goto('/admin/staff');
    const sizes = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontSize,
      description: getComputedStyle(document.querySelector('[data-slot="page-header-description"]')!).fontSize,
    }));
    expect(sizes).toEqual({ body: '14px', description: '14px' });
  });
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

/** Tabele list obiektów (bez macierzy Danych Dziennych, która ma inną budowę). */
const ROW_SCREENS: { role: 'org_admin' | 'super_admin'; paths: string[] }[] = [
  { role: 'org_admin', paths: ['/admin/residents', '/admin/staff', '/admin/invitations', '/admin/facility', '/admin/audit'] },
  { role: 'super_admin', paths: ['/admin/organizations', '/admin/iam'] },
];

test.describe('Spójność ekranów — jedna wysokość wiersza tabeli (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const { role, paths } of ROW_SCREENS) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${role}: wiersze, nagłówki i odstępy komórek jednakowe we wszystkich tabelach`, async ({ loginPage, page }) => {
      await loginPage.loginAs(role);
      await page.setViewportSize({ width: 1440, height: 900 });
      const screens = new PageConsistencyPage(page);
      const rows = new Set<number>();
      const heads = new Set<number>();
      const paddings = new Set<string>();

      for (const path of paths) {
        await screens.goto(path);
        await page.evaluate(() => window.localStorage.clear());
        await screens.goto(path);
        const m = await screens.tableRowMetrics();
        m.rowHeights.forEach((h) => rows.add(h));
        m.headHeights.forEach((h) => heads.add(h));
        m.cellPaddings.forEach((p) => paddings.add(p));
      }

      expect([...heads], 'różne wysokości nagłówków tabel').toHaveLength(1);
      expect([...paddings], 'różne odstępy komórek').toHaveLength(1);
      expect([...rows].sort(), 'różne wysokości wierszy').toHaveLength(1);
    });
  }
});

const CARD_SCREENS: { role: 'org_admin' | 'super_admin' | 'nurse' | 'family'; paths: string[] }[] = [
  { role: 'org_admin', paths: ['/admin', '/admin/reports/statistics', '/admin/reports/daily', '/admin/audit', '/settings/profile'] },
  { role: 'super_admin', paths: ['/admin/organizations'] },
  { role: 'nurse', paths: ['/staff/reports', '/staff/agenda', '/voice'] },
  { role: 'family', paths: ['/dashboard', '/consents'] },
];

test.describe('Spójność ekranów — jedna karta i jeden tytuł karty (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const { role, paths } of CARD_SCREENS) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${role}: karty o jednej ramce, tytuły kart o jednej typografii`, async ({ loginPage, page }) => {
      await loginPage.loginAs(role);
      await page.evaluate(() => window.localStorage.setItem('sc-theme', 'light'));
      const screens = new PageConsistencyPage(page);
      const frames = new Set<string>();
      const titles = new Set<string>();
      for (const path of paths) {
        await screens.goto(path);
        const snap = await screens.cardSnapshot();
        snap.frames.forEach((f) => frames.add(f));
        snap.titles.forEach((t) => titles.add(t));
      }
      expect([...frames].length, `różne ramki kart: ${[...frames].join(' || ')}`).toBeLessThanOrEqual(1);
      expect([...titles].length, 'różna typografia tytułów kart').toBeLessThanOrEqual(1);
    });
  }
});

test.describe('Pulpit placówki — karty wskaźników szablonu (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - wskaźniki w MetricCard o jednym kształcie, bez zmyślonego statusu', async ({ loginPage, page }) => {
    await loginPage.loginAs('org_admin');
    const screens = new PageConsistencyPage(page);
    await screens.goto('/admin');
    const cards = page.locator('[data-slot="metric-card"]');
    expect(await cards.count()).toBeGreaterThanOrEqual(3);
    const heights = await cards.evaluateAll((els) => [...new Set(els.map((e) => Math.round(e.getBoundingClientRect().height)))]);
    expect(heights, 'karty wskaźników różnej wysokości').toHaveLength(1);
    // CLAUDE.md: zakaz fabrykowania danych — „Status systemu: Stabilny” nie wynikał z żadnego pomiaru
    await expect(page.getByText('Stabilny', { exact: true })).toHaveCount(0);
  });
});

/** Listy obiektów z tabelą: wyszukiwarka i filtry w nagłówku tej samej karty co tabela (szablon „users”). */
const LIST_CARD_PATHS = ['/admin/residents', '/admin/facility', '/staff', '/admin/staff', '/admin/invitations', '/admin/iam'];

/** Widoki list z wyszukiwarką (i filtrami na tablicy dyżuru oraz w strukturze placówki). */
const TOOLBAR_SCREENS: { role: 'org_admin' | 'nurse' | 'super_admin'; paths: string[] }[] = [
  { role: 'org_admin', paths: ['/admin/residents', '/admin/facility', '/admin/messages', '/admin/staff', '/admin/invitations'] },
  { role: 'super_admin', paths: ['/admin/iam'] },
  { role: 'nurse', paths: ['/staff', '/voice'] },
];

test.describe('Spójność ekranów — wspólny pasek wyszukiwania i filtrów (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const { role, paths } of TOOLBAR_SCREENS) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${role}: jedna wyszukiwarka na widok, jeden kształt pól i filtrów`, async ({ loginPage, page }) => {
      await loginPage.loginAs(role);
      const screens = new PageConsistencyPage(page);
      const missing: string[] = [];
      const outsideCard: string[] = [];
      const searchShapes = new Set<string>();
      const chipShapes = new Set<string>();

      for (const path of paths) {
        await screens.goto(path);
        const snap = await screens.toolbarSnapshot();
        if (snap.searchFields !== 1) missing.push(`${path}: ${snap.searchFields} wyszukiwarek`);
        if (LIST_CARD_PATHS.includes(path) && !(await page.locator('main [data-slot="table-card"]:visible [data-slot="search-field"]').count())) {
          outsideCard.push(path);
        }
        snap.searchShapes.forEach((s) => searchShapes.add(s));
        snap.chipShapes.forEach((s) => chipShapes.add(s));
      }

      expect(missing, 'widoki bez jednej wspólnej wyszukiwarki SearchField').toEqual([]);
      expect(outsideCard, 'listy, w których wyszukiwarka nie jest w nagłówku karty listy (układ szablonu)').toEqual([]);
      expect([...searchShapes], 'różne kształty wyszukiwarek').toHaveLength(1);
      expect([...chipShapes].length, 'różne wysokości przycisków filtrów').toBeLessThanOrEqual(1);
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
