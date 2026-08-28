#!/usr/bin/env node
/**
 * sc-naming — skan repozytorium pod kątem porzuconych nazw (ADR-002, ADR-004).
 * Rdzeń nazywa się residents i organizations. Stare nazwy żyją wyłącznie
 * w warstwie integracyjnej jako identyfikatory zewnętrzne.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SC_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
// .claude/ i .agents/ to instrukcje dla agentów — wymieniają porzucone nazwy po to,
// żeby ich zakazać. Skaner nie odróżnia użycia od zacytowania, więc reguła, która
// nie pomija tych katalogów, uniemożliwia napisanie instrukcji o samej regule.
const SKIP_DIRS = ['node_modules', '.git', '.next', 'dist', 'generated', 'docs', 'contracts', '.claude', '.agents'];
/**
 * Pliki instrukcji i dokumentacji są pomijane, bo wymieniają porzucone nazwy po to,
 * żeby ich zakazać. Skaner porównuje tekst i nie odróżnia użycia od zacytowania —
 * bez tego wyjątku nie da się napisać zdania „nazwa X jest porzucona".
 * Skanujemy kod i schemat; to tam nazwa cokolwiek robi.
 */
const SKIP_FILE = /^(AGENTS|CLAUDE|README|INSTALL|NAMING|01-ADR-decisions|00-PREREQUISITES|02-SETUP-STEP-BY-STEP)\.md$|CHANGES-ADR|\.test\.|\.spec\./;

const RETIRED = [
  { from: 'care_homes', to: 'organizations', adr: 'ADR-002' },
  { from: 'care_home_id', to: 'organization_id', adr: 'ADR-002' },
  { from: 'patients', to: 'residents', adr: 'ADR-002' },
  { from: 'patient_id', to: 'resident_id', adr: 'ADR-002' },
  { from: 'polar_user_id', to: 'external_wearable_links.external_user_id', adr: 'ADR-002' },
  { from: 'polar_daily_activity', to: 'wellness_daily', adr: 'ADR-002' },
  { from: 'polar_sleep', to: 'wellness_daily', adr: 'ADR-002' },
  { from: 'polar_heart_rate', to: 'wellness_daily', adr: 'ADR-002' },
  { from: 'polar_hrv', to: 'wellness_daily', adr: 'ADR-002' },
];
const ALLOW_IN = ['external', 'integration', 'migrations/legacy', 'providers/polar'];

const walk = (d, out = []) => {
  if (!existsSync(d)) return out;
  for (const e of readdirSync(d)) {
    if (SKIP_DIRS.includes(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|sql|prisma|md)$/.test(e) && !SKIP_FILE.test(e)) out.push(p);
  }
  return out;
};

const hits = [];
for (const f of walk(ROOT)) {
  const rel = f.replace(ROOT + '/', '');
  if (ALLOW_IN.some((a) => rel.includes(a))) continue;
  const txt = readFileSync(f, 'utf8');
  for (const r of RETIRED) {
    const m = new RegExp(`\\b${r.from}\\b`).exec(txt);
    if (m) hits.push({ rel, ...r });
  }
}

if (!hits.length) { console.log('  ✓ Brak porzuconych nazw poza warstwą integracyjną.'); process.exit(0); }
console.log(`\n  Porzucone nazwy (${hits.length}):\n`);
for (const h of hits) console.log(`  ✗ ${h.rel}\n      "${h.from}" → "${h.to}" (${h.adr})`);
console.log('');
process.exit(1);
