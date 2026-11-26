#!/usr/bin/env node
/**
 * ci-workflow-check — pilnuje łańcucha zadań na pushu w .github/workflows/ci.yml (#343).
 *
 * PO CO TO ISTNIEJE
 * Zadanie `database` działa tylko dla pull requestów, więc na pushu jest pominięte. Zadanie,
 * którego `if` nie ma funkcji statusu, dostaje od GitHub Actions niejawne `success()` dla
 * wszystkich przodków w łańcuchu `needs`. Pominięty przodek pomija wtedy publikację na Vercelu,
 * migracje stagingu i alias (regresja z 217d7275, 2026-11-25).
 *
 * REGUŁA
 * Każde zadanie uruchamiane na pushu, które ma `needs`, ma w `if`:
 *   - `!cancelled()` albo `always()`,
 *   - `needs.<zależność>.result == 'success'` dla każdej bezpośredniej zależności.
 *
 * UŻYCIE
 *   node tools/ci-workflow-check.mjs            # sprawdza .github/workflows/ci.yml
 *   node tools/ci-workflow-check.mjs <ścieżka>  # sprawdza wskazany plik
 *
 * Parser czyta wyłącznie klucze `needs` i `if` zadań na poziomie `jobs:` (wcięcie 2 i 4 spacje).
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CI_WORKFLOW = join(ROOT, '.github/workflows/ci.yml');

/** Zadania z `jobs:` z bezpośrednimi zależnościami i warunkiem `if`. */
export function parseJobs(yaml) {
  const lines = yaml.split('\n');
  const start = lines.findIndex((line) => line === 'jobs:');
  const jobs = [];
  let current = null;
  for (const line of lines.slice(start + 1)) {
    const job = /^ {2}([a-z_][\w-]*):\s*$/.exec(line);
    if (job) {
      current = { name: job[1], needs: [], ifExpr: '' };
      jobs.push(current);
      continue;
    }
    if (!current) continue;
    const needs = /^ {4}needs:\s*(.+)$/.exec(line);
    if (needs) current.needs = needs[1].replace(/[[\]\s]/g, '').split(',').filter(Boolean);
    const cond = /^ {4}if:\s*(.+)$/.exec(line);
    if (cond) current.ifExpr = cond[1];
  }
  return jobs;
}

const runsOnPush = (job) => job.ifExpr.includes("github.event_name == 'push'");
const hasStatusFunction = (job) => /!cancelled\(\)|always\(\)/.test(job.ifExpr);

/** Opisy luk: zadania na pushu z `needs` bez funkcji statusu albo bez jawnego wyniku zależności. */
export function pushChainGaps(jobs) {
  return jobs.filter((job) => runsOnPush(job) && job.needs.length > 0).flatMap((job) => {
    const gaps = [];
    if (!hasStatusFunction(job)) gaps.push(`${job.name}: brak !cancelled() albo always()`);
    for (const need of job.needs) {
      if (!job.ifExpr.includes(`needs.${need}.result == 'success'`)) {
        gaps.push(`${job.name}: brak needs.${need}.result == 'success'`);
      }
    }
    return gaps;
  });
}

/** Zadania z pliku workflow (domyślnie ci.yml). */
export function loadCiJobs(path = CI_WORKFLOW) {
  return parseJobs(readFileSync(path, 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const path = process.argv[2] || CI_WORKFLOW;
  const gaps = pushChainGaps(loadCiJobs(path));
  if (gaps.length > 0) {
    console.error(`  ✗ Łańcuch zadań na pushu ma luki (${path}):`);
    for (const gap of gaps) console.error(`    - ${gap}`);
    process.exit(1);
  }
  console.log('  ✓ Łańcuch zadań na pushu sprawdza wynik zależności');
}
