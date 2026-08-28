#!/usr/bin/env node
/**
 * sc-selftest — dowód żywotności reguł bramki.
 *
 * Każda mutacja psuje kontrakt w jeden konkretny sposób i sprawdza, czy
 * walidator to wyłapie. Reguła, która nie zapala się na swojej mutacji,
 * jest martwa — wygląda jak ochrona, a nią nie jest.
 *
 * Mutacje są nakładane na KOPIĘ kontraktów w katalogu tymczasowym.
 * Oryginał nie jest dotykany.
 */
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SC_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');

const MUTATIONS = [
  { rule: 'R02-consent-grantor', file: 'roles.contract.mjs', from: "export const CONSENT_GRANTORS = ['resident_self', 'legal_guardian'];", to: "export const CONSENT_GRANTORS = ['resident_self', 'legal_guardian', 'family'];", desc: 'rodzina wyraża zgodę na dane o zdrowiu' },
  { rule: 'R03-consent-immutable', file: 'roles.contract.mjs', from: "{ resource: 'consent_ledger',          read: ['org_admin:own', 'legal_guardian:own'],     create: ['org_admin'],    update: [],", to: "{ resource: 'consent_ledger',          read: ['org_admin:own', 'legal_guardian:own'],     create: ['org_admin'],    update: ['org_admin'],", desc: 'rejestr zgód staje się edytowalny' },
  { rule: 'R04-mdr-family-metrics', file: 'presentation.contract.mjs', from: "{ id: 'sleep_start_time',   unit: 'godzina', source: 'wellness_daily.sleep_start_time',   kind: 'BEHAVIORAL', desc: 'Godzina zaśnięcia.' },", to: "{ id: 'hrv_ms',   unit: 'ms', source: 'wellness_daily.hrv_ms',   kind: 'PHYSIOLOGICAL', desc: 'HRV.' },", desc: 'HRV wystawione bliskim' },
  { rule: 'R05-mapping-visibility', file: 'integration.contract.mjs', from: "{ canonical: 'hrv_ms',                 provider: 'POLAR', from: 'nightly_recharge.heart_rate_variability_ms', kind: 'PHYSIOLOGICAL', familyVisible: false },", to: "{ canonical: 'hrv_ms',                 provider: 'POLAR', from: 'nightly_recharge.heart_rate_variability_ms', kind: 'PHYSIOLOGICAL', familyVisible: true },", desc: 'mapowanie fizjologiczne oznaczone jako widoczne' },
  { rule: 'R06-core-decoupled', file: 'integration.contract.mjs', from: "  externalKeys: ['provider', 'external_user_id', 'external_device_id'],", to: "  externalKeys: ['provider', 'polar_user_id', 'external_device_id'],", desc: 'identyfikator dostawcy wraca do rdzenia' },
  { rule: 'R07-redact-before-llm', file: 'voice.contract.mjs', from: "    reachesLLM: false,\n    audience: ['nurse', 'org_admin'],\n    desc: 'Leki, diagnozy", to: "    reachesLLM: true,\n    audience: ['nurse', 'org_admin'],\n    desc: 'Leki, diagnozy", desc: 'dane medyczne trafiają do modelu' },
  { rule: 'R08-zero-guessing', file: 'voice.contract.mjs', from: "{ id: 'CAPTURE',   actor: 'nurse',        input: 'audio + resident_id (UUID)'", to: "{ id: 'CAPTURE',   actor: 'nurse',        input: 'audio'", desc: 'nagranie bez twardego identyfikatora' },
  { rule: 'R09-human-approval', file: 'voice.contract.mjs', from: "{ id: 'APPROVE',   actor: 'nurse',", to: "{ id: 'APPROVE',   actor: 'llm',", desc: 'model publikuje raport bez człowieka' },
  { rule: 'R10-no-metric-alarm', file: 'notifications.contract.mjs', from: "{ id: 'F1', domain: 'FAMILY', trigger: 'daily_report_published'", to: "{ id: 'F1', domain: 'FAMILY', trigger: 'steps_below_threshold'", desc: 'alarm o spadku liczby kroków do rodziny' },
  { rule: 'R11-notif-shape', file: 'notifications.contract.mjs', from: "req: ['NTF-REPORT-READY', 'NTF-NO-PII'], status: 'STABLE'", to: "req: ['NTF-NIEISTNIEJACE'], status: 'STABLE'", desc: 'powiadomienie wskazuje nieistniejące wymaganie' },
  { rule: 'R12-rbac', file: 'roles.contract.mjs', from: "{ resource: 'residents',               read: ['org_admin:own', 'nurse:own', 'legal_guardian:own', 'family:own']", to: "{ resource: 'residents',               read: ['org_admin:own', 'nurse:own', 'opiekun:own', 'family:own']", desc: 'nieistniejąca rola w macierzy' },
  { rule: 'R13-draft-isolation', file: 'roles.contract.mjs', from: "{ resource: 'daily_logs',              read: ['nurse:own', 'org_admin:own'],", to: "{ resource: 'daily_logs',              read: ['nurse:own', 'org_admin:own', 'family:own'],", desc: 'rodzina czyta brudnopis z danymi medycznymi' },
  { rule: 'R14-audit-append-only', file: 'roles.contract.mjs', from: "{ resource: 'audit_logs',              read: ['super_admin', 'org_admin:own'],            create: ['org_admin'],    update: [],", to: "{ resource: 'audit_logs',              read: ['super_admin', 'org_admin:own'],            create: ['org_admin'],    update: ['super_admin'],", desc: 'super admin edytuje rejestr audytowy' },
  { rule: 'R15-mfa-scope', file: 'roles.contract.mjs', from: "export const MFA_REQUIRED_ROLES = ['super_admin', 'org_admin', 'nurse'];", to: "export const MFA_REQUIRED_ROLES = ['super_admin', 'org_admin'];", desc: 'pielęgniarka bez drugiego składnika' },
  { rule: 'R16-ingest-guard', file: 'integration.contract.mjs', from: "{ id: 'active_consent',   desc: 'Aktywna zgoda na cel wellness_data_ingest w consent_ledger.', onFail: 'REJECT_AND_LOG' },", to: "", desc: 'ingest bez sprawdzania zgody' },
  { rule: 'R18-vocabulary', file: 'presentation.contract.mjs', from: "{ term: 'pacjent',  replacement: 'podopieczny / senior / pensjonariusz', reason: 'MDR — nomenklatura medyczna sugeruje leczenie, nie opiekę.' },", to: "", desc: 'zakaz słowa „pacjent" usunięty' },
  { rule: 'R19-req-shape', file: 'requirements.contract.mjs', from: "R('FAM-AGENDA', { source: 'SC-FAM-06', domain: 'family',", to: "R('FAM-AGENDA', { source: 'SC-FAM-06',", desc: 'wymaganie bez domeny' },
  { rule: 'R20-high-risk-testable', file: 'requirements.contract.mjs', from: "acceptance: ['Wiadomość zawiera wyłącznie zachętę do otwarcia portalu', 'Brak imienia, nazwiska i jakiejkolwiek metryki w treści', 'Test sprawdza szablony, nie tylko pojedynczą wysyłkę'], risk: 'HIGH' }", to: "acceptance: ['Bez PII'], risk: 'HIGH' }", desc: 'kryterium wysokiego ryzyka zbyt ogólne' },
  { rule: 'R22-transfer-exception', file: 'integration.contract.mjs', from: "exceptionApprovedBy: 'Michal, 2026-08-27',", to: "", desc: 'dostawca poza EOG bez odnotowanej zgody na wyjątek' },
  { rule: 'R23-autonomy-limits', file: 'autonomy.contract.mjs', from: "  { id: 'mdr_boundary',         desc: 'Zmiana zakresu danych widocznych bliskim albo klasyfikacji pola jako behawioralne/fizjologiczne.', reason: 'Decyduje o klasyfikacji produktu jako wyrobu medycznego. Nieodwracalna reputacyjnie i prawnie.' },\n", to: "", desc: 'agent sam decyduje o granicy MDR' },
  { rule: 'R24-design-a11y', file: 'design.contract.mjs', from: "  baseSize: '17px',", to: "  baseSize: '14px',", desc: 'tekst zmniejszony poniżej progu czytelności' },
  { rule: 'R19-req-shape', file: 'requirements.contract.mjs', from: "deferredUntil: 'Decyzja o skalowaniu poza pilotaż (Michał) albo pierwszy incydent wymagający odtworzenia stanu bazy co do sekundy.', risk: 'MEDIUM' }),", to: "risk: 'MEDIUM' }),", desc: 'status DEFERRED bez deferredUntil — odłożone bezterminowo' },
  { rule: 'R25-occupancy-integrity', file: 'facility.contract.mjs', from: "{ id: 'bed_single_occupant', desc: 'Przypisanie do łóżka z aktywnym przypisaniem innej osoby jest odrzucane, nie nadpisywane.', onViolation: 'REJECT' },", to: "{ id: 'bed_single_occupant', desc: 'Przypisanie do łóżka z aktywnym przypisaniem innej osoby jest odrzucane, nie nadpisywane.', onViolation: 'OVERWRITE' },", desc: 'podwójne przypisanie łóżka ciche nadpisanie zamiast odrzucenia' },
  { rule: 'R21-send-window', file: 'notifications.contract.mjs', from: "SMS: '08:00-20:00'", to: "SMS: '00:00-23:59'", desc: 'SMS o raporcie wysyłany w nocy' },
];

const results = [];
for (const mut of MUTATIONS) {
  const tmp = mkdtempSync(join(tmpdir(), 'sc-selftest-'));
  try {
    cpSync(join(ROOT, 'contracts'), join(tmp, 'contracts'), { recursive: true });
    cpSync(join(ROOT, 'tools'), join(tmp, 'tools'), { recursive: true });
    const target = join(tmp, 'contracts', mut.file);
    const before = readFileSync(target, 'utf8');
    if (!before.includes(mut.from)) {
      results.push({ ...mut, ok: false, why: 'wzorzec mutacji nie pasuje do kontraktu — mutacja jest nieaktualna' });
      continue;
    }
    writeFileSync(target, before.replace(mut.from, mut.to));
    let blocked = false;
    try {
      execFileSync('node', [join(tmp, 'tools', 'sc-validate.mjs')], { env: { ...process.env, SC_PROJECT_DIR: tmp }, stdio: 'pipe' });
    } catch {
      blocked = true;
    }
    results.push({ ...mut, ok: blocked, why: blocked ? '' : 'walidator przepuścił zepsuty kontrakt' });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

console.log('\n  Test mutacyjny bramki Silver Care\n');
let dead = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ✓ ${r.rule.padEnd(28)} zablokowała: ${r.desc}`);
  } else {
    console.log(`  ✗ ${r.rule.padEnd(28)} MARTWA — ${r.why}`);
    dead++;
  }
}
console.log(`\n  Wynik: ${results.length - dead}/${results.length} reguł udowodniło, że potrafi zablokować zmianę.`);
if (dead) {
  console.log('  ✗ Martwe reguły dają fałszywe poczucie ochrony.\n');
  process.exit(1);
}
console.log('  ✓ Każda reguła bramki jest żywa.\n');
