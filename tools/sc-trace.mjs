#!/usr/bin/env node
/**
 * sc-trace — identyfikowalność: które wymagania mają test, które nie.
 * Test bez znacznika @REQ wskazującego istniejące wymaganie nie ma prawa przejść.
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SC_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const ENFORCE = process.argv.includes('--enforce');
const { REQUIREMENTS } = await import(`file://${join(ROOT, 'contracts/requirements.contract.mjs')}`);
const known = new Set(REQUIREMENTS.map((r) => r.id));

const walk = (d, out = []) => {
  if (!existsSync(d)) return out;
  for (const e of readdirSync(d)) {
    if (['node_modules', '.git', '.next', 'dist', 'generated'].includes(e)) continue;
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(test|spec)\.(ts|tsx)$/.test(e)) out.push(p);
  }
  return out;
};

const covered = new Map();
const orphans = [];
for (const root of ['apps', 'packages', 'e2e', 'supabase']) {
  for (const f of walk(join(ROOT, root))) {
    const txt = readFileSync(f, 'utf8');
    const tags = [...txt.matchAll(/@REQ:\s*([A-Z0-9-]+)/g)].map((m) => m[1]);
    if (!tags.length) { orphans.push(f.replace(ROOT + '/', '')); continue; }
    for (const t of tags) {
      if (!known.has(t)) orphans.push(`${f.replace(ROOT + '/', '')} → nieznane wymaganie "${t}"`);
      else covered.set(t, (covered.get(t) || 0) + 1);
    }
  }
}

const uncovered = REQUIREMENTS.filter((r) => !covered.has(r.id));
const highUncovered = uncovered.filter((r) => r.risk === 'HIGH');

console.log(`\n  Identyfikowalność Silver Care`);
console.log(`  Wymagań: ${REQUIREMENTS.length} | z testem: ${covered.size} | bez testu: ${uncovered.length}`);
if (highUncovered.length) {
  console.log(`\n  Bez testu, ryzyko HIGH (${highUncovered.length}):`);
  for (const r of highUncovered) console.log(`    ${r.id.padEnd(28)} ${r.statement.slice(0, 60)}`);
}
if (orphans.length) {
  console.log(`\n  Testy bez poprawnego znacznika @REQ (${orphans.length}):`);
  for (const o of orphans.slice(0, 20)) console.log(`    ${o}`);
}
if (ENFORCE && orphans.length) {
  console.log('\n  ✗ Każdy test musi wskazywać wymaganie znacznikiem @REQ.\n');
  process.exit(1);
}
console.log('');
