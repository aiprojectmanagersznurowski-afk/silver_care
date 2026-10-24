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

test.describe('Portal rodziny — nagłówek i tło jak w reszcie aplikacji (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - nagłówek 48px, przyciski 38px, aktywna pozycja menu neutralna, białe tło', async ({ loginPage, page }) => {
    await loginPage.loginAs('family');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => window.localStorage.setItem('sc-theme', 'light'));
    const screens = new PageConsistencyPage(page);
    await screens.goto('/agenda');
    const shell = await page.evaluate(() => {
      const header = document.querySelector('header[data-slot="family-header"]');
      const buttons = header ? [...header.querySelectorAll('[data-testid="family-notifications-bell"], [data-slot="theme-toggle"]')] : [];
      const active = header?.querySelector('nav a[aria-current="page"]');
      const main = document.querySelector('main');
      return {
        headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
        buttonHeights: [...new Set(buttons.map((b) => Math.round(b.getBoundingClientRect().height)))],
        activeBg: active ? getComputedStyle(active).backgroundColor : 'brak aktywnej pozycji',
        primary: getComputedStyle(document.documentElement).getPropertyValue('--primary').trim(),
        mainBg: main ? getComputedStyle(main.parentElement as Element).backgroundColor : '',
      };
    });
    expect(shell.headerHeight).toBe(48);
    expect(shell.buttonHeights).toEqual([38]);
    expect(shell.activeBg).not.toBe('brak aktywnej pozycji');
    expect(shell.activeBg).not.toBe(shell.primary);
    expect(shell.activeBg).not.toBe('rgb(47, 111, 94)');
    expect(shell.mainBg).toBe('rgb(255, 255, 255)');
  });
});

test.describe('Czat — ten sam wygląd w portalu rodziny i u kierownika placówki (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  test('@REQ: UI-TEMPLATE-ALIGNMENT - pole wiadomości i przycisk wysyłania o tym samym kształcie w obu czatach', async ({ loginPage, page, browser }) => {
    const shapeOf = (p: typeof page) => p.evaluate(() => {
      const bar = document.querySelector('[data-slot="chat-input"]');
      const send = document.querySelector('[data-slot="chat-send"]');
      if (!bar || !send) return null;
      const b = getComputedStyle(bar); const s = getComputedStyle(send);
      return { input: [b.borderTopLeftRadius, b.borderTopWidth].join(' | '), send: [s.borderTopLeftRadius, Math.round(send.getBoundingClientRect().height)].join(' | ') };
    });

    await loginPage.loginAs('family');
    await page.goto('/messages');
    await page.waitForLoadState('networkidle');
    const family = await shapeOf(page);
    expect(family, 'brak wspólnego pola wiadomości w portalu rodziny').not.toBeNull();

    const context = await browser.newContext();
    const adminPage = await context.newPage();
    const { LoginPage } = await import('../page-objects/LoginPage');
    await new LoginPage(adminPage).loginAs('org_admin');
    await adminPage.goto('/admin/messages');
    await adminPage.waitForLoadState('networkidle');
    const firstThread = adminPage.locator('[data-testid="thread-item"]').first();
    if (await firstThread.count()) await firstThread.click();
    const admin = await shapeOf(adminPage);
    await context.close();

    if (admin) expect(admin).toEqual(family);
    else test.info().annotations.push({ type: 'uwaga', description: 'brak wątków u kierownika — porównano tylko portal rodziny' });
  });
});

test.describe('Tryb ciemny — czytelne przyciski i filtry (@REQ: UI-ACCESSIBILITY)', () => {
  test('@REQ: UI-ACCESSIBILITY - tablica dyżuru w trybie ciemnym: tekst przycisków ≥4.5:1, obramowanie ≥3:1 (WCAG 1.4.3, 1.4.11)', async ({ loginPage, page }) => {
    await loginPage.loginAs('nurse');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => window.localStorage.setItem('sc-theme', 'dark'));
    const screens = new PageConsistencyPage(page);
    await screens.goto('/staff');
    const contrasts = await screens.buttonContrasts();
    expect(contrasts.length, 'brak przycisków do zmierzenia').toBeGreaterThan(3);
    const weak = contrasts.filter((c) => c.text < 4.5 || c.border < 3);
    expect(weak, 'przyciski słabo widoczne w trybie ciemnym').toEqual([]);
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

/** Tabele z kolumną „Akcje": akcje wiersza w menu „⋯" jak w szablonie; na tablicy dyżuru zostaje „Nagraj notatkę". */
const ROW_ACTION_SCREENS: { role: 'org_admin' | 'super_admin' | 'nurse'; paths: string[] }[] = [
  { role: 'org_admin', paths: ['/admin/residents', '/admin/staff', '/admin/invitations', '/admin/facility'] },
  { role: 'super_admin', paths: ['/admin/organizations', '/admin/iam'] },
  { role: 'nurse', paths: ['/staff'] },
];
const VISIBLE_ROW_ACTIONS = ['Nagraj notatkę'];

test.describe('Spójność ekranów — akcje wiersza w menu „⋯" (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  for (const { role, paths } of ROW_ACTION_SCREENS) {
    test(`@REQ: UI-TEMPLATE-ALIGNMENT - ${role}: każdy wiersz ma jedno menu akcji o tym samym kształcie`, async ({ loginPage, page }) => {
      await loginPage.loginAs(role);
      await page.setViewportSize({ width: 1440, height: 900 });
      const screens = new PageConsistencyPage(page);
      const shapes = new Set<string>();

      for (const path of paths) {
        await screens.goto(path);
        await page.evaluate(() => window.localStorage.clear());
        await screens.goto(path);
        const s = await screens.rowActionSnapshot();
        expect(s.menus, `${path}: wiersze bez menu „⋯"`).toBe(s.rows);
        expect(s.stray.filter((label) => !VISIBLE_ROW_ACTIONS.includes(label)), `${path}: akcje poza menu`).toEqual([]);
        s.triggerShapes.forEach((shape) => shapes.add(shape));
      }

      expect([...shapes], 'różne kształty przycisku „⋯"').toHaveLength(1);
    });
  }
});

const CARD_SCREENS:{ role: 'org_admin' | 'super_admin' | 'nurse' | 'family'; paths: string[] }[] = [
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
