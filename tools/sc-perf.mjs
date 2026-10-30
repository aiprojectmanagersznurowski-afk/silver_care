#!/usr/bin/env node
/**
 * sc-perf — pomiar czasów ładowania głównych ekranów (WO-NFR-PERF-SCREEN-LOAD, etap 1).
 *
 * Loguje się kontami E2E (kierownik, personel opiekuńczy, rodzina) i tylko czyta ekrany.
 * Każdy ekran mierzony RUNS razy w tej samej sesji; raport z medianą:
 *   TTFB (odpowiedź serwera), LCP (pojawienie się treści), czas do bezczynności sieci, transfer,
 *   liczba zapytań do Supabase z przeglądarki.
 *
 * Użycie:
 *   node tools/sc-perf.mjs [BASE_URL] [RUNS] [plik.json]
 *   node tools/sc-perf.mjs https://silver-care-six.vercel.app 3 perf-prod.json
 *   node tools/sc-perf.mjs http://localhost:3000 3
 *
 * Porównanie przed/po: uruchom na tym samym adresie przed zmianą i po niej, z tą samą liczbą przebiegów.
 */
import { writeFileSync } from 'node:fs';
import dotenv from 'dotenv';
import { chromium } from '@playwright/test';

dotenv.config({ path: '.env.local', quiet: true });

const [BASE = 'http://localhost:3000', RUNS_ARG = '3', OUT] = process.argv.slice(2);
const RUNS = Number(RUNS_ARG);
const PASSWORD = process.env.E2E_USER_PASSWORD || 'SilverTest123!';

const PLAN = [
  { role: 'org_admin', email: 'e2e.admin@silvercare.test', screens: ['/admin', '/admin/residents', 'RESIDENT_CARD', '/admin/staff', '/admin/messages', '/admin/facility', '/admin/reports/daily'] },
  { role: 'nurse', email: 'e2e.nurse@silvercare.test', screens: ['/staff', '/staff/agenda', '/staff/reports', '/voice'] },
  { role: 'family', email: 'e2e.family@silvercare.test', screens: ['/dashboard', '/agenda', '/messages'] },
];

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

async function measure(page, url) {
  let supabaseCalls = 0;
  const onReq = (r) => { if (r.url().includes('supabase.co')) supabaseCalls++; };
  page.on('request', onReq);
  const t0 = Date.now();
  const resp = await page.goto(url, { waitUntil: 'load', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  const settledMs = Date.now() - t0;
  page.off('request', onReq);
  const nav = await page.evaluate(() => new Promise((resolve) => {
    const n = performance.getEntriesByType('navigation')[0];
    let lcp = 0;
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch { /* przeglądarka bez LCP */ }
    setTimeout(() => resolve({
      ttfb: Math.round(n.responseStart),
      lcp: Math.round(lcp),
      transferKB: Math.round(performance.getEntriesByType('resource').reduce((s, r) => s + (r.transferSize || 0), n.transferSize || 0) / 1024),
    }), 300);
  }));
  return { status: resp?.status() ?? 0, settledMs, supabaseCalls, ...nav };
}

async function login(page, email) {
  await page.goto('/login');
  try { await page.locator('#email').waitFor({ state: 'visible', timeout: 2000 }); } catch { await page.locator('body').click(); }
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  const t = Date.now();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 30000 });
  return Date.now() - t;
}

const browser = await chromium.launch();
const results = [];
for (const { role, email, screens } of PLAN) {
  const ctx = await browser.newContext({ baseURL: BASE, viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const loginMs = await login(page, email);
  console.log(`${role}: logowanie ${loginMs} ms`);

  for (let screen of screens) {
    let label = screen;
    if (screen === 'RESIDENT_CARD') {
      await page.goto('/admin/residents', { waitUntil: 'networkidle' });
      const href = await page.locator('a[href^="/admin/residents/"]').first().getAttribute('href').catch(() => null);
      if (!href) { console.log('  karta podopiecznego: brak linku, pomijam'); continue; }
      screen = href;
      label = '/admin/residents/[id]';
    }
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await measure(page, screen));
    const pick = (k) => runs.map((r) => r[k]);
    const row = {
      role, screen: label, status: runs[0].status,
      ttfb: median(pick('ttfb')), lcp: median(pick('lcp')), settledMs: median(pick('settledMs')),
      transferKB: median(pick('transferKB')), supabaseCalls: median(pick('supabaseCalls')),
    };
    results.push({ ...row, loginMs });
    console.log(`  ${label.padEnd(24)} TTFB ${String(row.ttfb).padStart(5)} | LCP ${String(row.lcp).padStart(5)} | bezczynność ${String(row.settledMs).padStart(5)} ms | ${row.transferKB} KB | z przeglądarki do Supabase: ${row.supabaseCalls}`);
  }
  await ctx.close();
}
await browser.close();

if (OUT) {
  writeFileSync(OUT, JSON.stringify({ base: BASE, runs: RUNS, at: new Date().toISOString(), results }, null, 2));
  console.log(`Zapisano ${OUT}`);
}
