#!/usr/bin/env node
/**
 * sc-contract-window — okno kontraktowe.
 * Zmiana źródła prawdy wymaga świadomego otwarcia okna przez człowieka.
 * Bez tego contracts/ jest dla agentów tylko do odczytu.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SC_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const F = join(ROOT, '.claude/state/contract-window.json');
const [cmd, ticket] = process.argv.slice(2);

const read = () => (existsSync(F) ? JSON.parse(readFileSync(F, 'utf8')) : { open: false });

if (cmd === 'open') {
  if (!ticket) { console.error('Podaj identyfikator wymagania lub ticketu: sc-contract-window.mjs open CONSENT-GRANTOR'); process.exit(2); }
  mkdirSync(dirname(F), { recursive: true });
  const expiresAt = new Date(Date.now() + 2 * 3600 * 1000).toISOString();
  writeFileSync(F, JSON.stringify({ open: true, ticket, openedAt: new Date().toISOString(), expiresAt }, null, 2));
  console.log(`  ✓ Okno kontraktowe otwarte dla "${ticket}". Wygasa: ${expiresAt}`);
  console.log('    Po zmianie kontraktu: node tools/sc-codegen.mjs && node tools/sc-validate.mjs && node tools/sc-selftest.mjs');
} else if (cmd === 'close') {
  mkdirSync(dirname(F), { recursive: true });
  writeFileSync(F, JSON.stringify({ open: false, closedAt: new Date().toISOString() }, null, 2));
  console.log('  ✓ Okno kontraktowe zamknięte.');
} else {
  const w = read();
  const live = w.open && (!w.expiresAt || Date.parse(w.expiresAt) > Date.now());
  console.log(live ? `  Okno OTWARTE (${w.ticket}), wygasa ${w.expiresAt}` : '  Okno zamknięte — contracts/ tylko do odczytu.');
}
