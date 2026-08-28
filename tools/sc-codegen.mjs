#!/usr/bin/env node
/**
 * sc-codegen — generuje TypeScript i dokumentację z kontraktów.
 * Kod importuje z @silvercare/contracts zamiast przepisywać wartości.
 * --check wykrywa ręczną edycję artefaktów (dryf).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SC_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const CHECK = process.argv.includes('--check');
const load = (f) => import(`file://${join(ROOT, 'contracts', f)}`);

const roles = await load('roles.contract.mjs');
const pres = await load('presentation.contract.mjs');
const voice = await load('voice.contract.mjs');
const integ = await load('integration.contract.mjs');
const notif = await load('notifications.contract.mjs');
const reqs = await load('requirements.contract.mjs');
const auto = await load('autonomy.contract.mjs');
const design = await load('design.contract.mjs');
const facility = await load('facility.contract.mjs');

const BANNER = '// WYGENEROWANE z contracts/ przez tools/sc-codegen.mjs — nie edytuj ręcznie.\n\n';
const emit = (name, obj) => `export const ${name} = ${JSON.stringify(obj, null, 2)} as const;\n\n`;

const files = {};

files['packages/contracts/src/generated/roles.ts'] = BANNER
  + emit('ROLES', roles.ROLES) + emit('STAFF_ROLES', roles.STAFF_ROLES)
  + emit('RELATIVE_ROLES', roles.RELATIVE_ROLES) + emit('MFA_REQUIRED_ROLES', roles.MFA_REQUIRED_ROLES)
  + emit('CONSENT_GRANTORS', roles.CONSENT_GRANTORS) + emit('CONSENT_PURPOSES', roles.CONSENT_PURPOSES)
  + emit('RESOURCES', roles.RESOURCES) + emit('MATRIX', roles.MATRIX)
  + emit('AUDIT_REQUIREMENTS', roles.AUDIT_REQUIREMENTS)
  + `export type Role = typeof ROLES[number]['id'];\nexport type Resource = typeof RESOURCES[number];\n`;

files['packages/contracts/src/generated/presentation.ts'] = BANNER
  + emit('FAMILY_VISIBLE_METRICS', pres.FAMILY_VISIBLE_METRICS)
  + emit('PHYSIOLOGICAL_FIELDS', pres.PHYSIOLOGICAL_FIELDS)
  + emit('FORBIDDEN_UI_TERMS', pres.FORBIDDEN_UI_TERMS)
  + emit('MDR_GUARDRAILS', pres.MDR_GUARDRAILS)
  + emit('REQUIRED_UI_STATES', pres.REQUIRED_UI_STATES)
  + `export const AI_DISCLOSURE_LABEL = ${JSON.stringify(pres.AI_DISCLOSURE_LABEL)} as const;\n\n`
  + `export type FamilyMetric = typeof FAMILY_VISIBLE_METRICS[number]['id'];\n\n`
  + `/** Strażnik czasu wykonania dla granicy MDR (ADR-005). */\n`
  + `export function assertFamilyVisible(field: string): void {\n`
  + `  if ((PHYSIOLOGICAL_FIELDS as readonly string[]).includes(field)) {\n`
  + `    throw new Error(\`ADR-005: pole "\${field}" jest parametrem fizjologicznym i nie może trafić do warstwy rodziny.\`);\n`
  + `  }\n}\n`;

files['packages/contracts/src/generated/voice.ts'] = BANNER
  + emit('TRANSCRIPT_STREAMS', voice.TRANSCRIPT_STREAMS) + emit('MEDICAL_CATEGORIES', voice.MEDICAL_CATEGORIES)
  + emit('PIPELINE_STAGES', voice.PIPELINE_STAGES) + emit('VOICE_RETENTION', voice.VOICE_RETENTION)
  + emit('AI_PROVENANCE_FIELDS', voice.AI_PROVENANCE_FIELDS) + emit('AI_FEEDBACK_CATEGORIES', voice.AI_FEEDBACK_CATEGORIES);

files['packages/contracts/src/generated/integration.ts'] = BANNER
  + emit('PROVIDERS', integ.PROVIDERS) + emit('WEARABLE_LINK', integ.WEARABLE_LINK)
  + emit('ORG_LINK', integ.ORG_LINK) + emit('FIELD_MAPPINGS', integ.FIELD_MAPPINGS)
  + emit('INGEST_PRECONDITIONS', integ.INGEST_PRECONDITIONS) + emit('SYNC_STALENESS', integ.SYNC_STALENESS);

files['packages/contracts/src/generated/notifications.ts'] = BANNER
  + emit('NOTIFICATIONS', notif.NOTIFICATIONS) + emit('FORBIDDEN_TRIGGERS', notif.FORBIDDEN_TRIGGERS)
  + emit('QUEUE_POLICY', notif.QUEUE_POLICY)
  + `export type NotificationId = typeof NOTIFICATIONS[number]['id'];\n`;

files['packages/contracts/src/generated/requirements.ts'] = BANNER
  + emit('REQUIREMENTS', reqs.REQUIREMENTS)
  + `export type RequirementId = typeof REQUIREMENTS[number]['id'];\n`;

files['packages/contracts/src/generated/autonomy.ts'] = BANNER
  + emit('DECISION_CLASSES', auto.DECISION_CLASSES) + emit('ESCALATION_TRIGGERS', auto.ESCALATION_TRIGGERS)
  + emit('DEFAULTS', auto.DEFAULTS) + emit('RETRY_POLICY', auto.RETRY_POLICY)
  + emit('SESSION_REPORT_SECTIONS', auto.SESSION_REPORT_SECTIONS);

files['packages/contracts/src/generated/design.ts'] = BANNER
  + emit('TYPOGRAPHY', design.TYPOGRAPHY) + emit('COLORS', design.COLORS) + emit('SPACING', design.SPACING)
  + emit('RADIUS', design.RADIUS) + emit('ELEVATION', design.ELEVATION) + emit('MOTION', design.MOTION)
  + emit('ACCESSIBILITY', design.ACCESSIBILITY) + emit('LAYOUT_PRINCIPLES', design.LAYOUT_PRINCIPLES);

// Tokeny CSS — jedno źródło dla Tailwinda i stylów globalnych.
{
  const line = (k, v) => `  --${k}: ${v};`;
  const css = [
    '/* WYGENEROWANE z contracts/design.contract.mjs — nie edytuj ręcznie. */',
    ':root {',
    line('font-sans', design.TYPOGRAPHY.fontStack),
    ...design.TYPOGRAPHY.scale.flatMap((s) => [
      line(`text-${s.id}`, s.size),
      line(`text-${s.id}-weight`, String(s.weight)),
      line(`text-${s.id}-leading`, String(s.lineHeight)),
    ]),
    ...Object.entries(design.SPACING.scale).map(([k, v]) => line(`space-${k}`, v)),
    ...Object.entries(design.RADIUS).filter(([k]) => k !== 'rules').map(([k, v]) => line(`radius-${k}`, v)),
    line('shadow-card', design.ELEVATION.card),
    line('shadow-modal', design.ELEVATION.modal),
    line('ease', design.MOTION.easing),
    ...Object.entries(design.MOTION.durations).map(([k, v]) => line(`duration-${k}`, v)),
    ...Object.entries(design.COLORS.light).map(([k, v]) => line(k, v.value)),
    '}',
    '',
    '@media (prefers-color-scheme: dark) {',
    '  :root {',
    ...Object.entries(design.COLORS.dark).map(([k, v]) => `  ${line(k, v.value)}`),
    '  }',
    '}',
    '',
    '@media (prefers-reduced-motion: reduce) {',
    '  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }',
    '}',
    '',
  ];
  files['packages/contracts/src/generated/tokens.css'] = css.join('\n');
}

files['packages/contracts/src/generated/facility.ts'] = BANNER
  + emit('FACILITY_HIERARCHY', facility.FACILITY_HIERARCHY) + emit('ROOM_SHAPE', facility.ROOM_SHAPE)
  + emit('BED_SHAPE', facility.BED_SHAPE) + emit('BED_ASSIGNMENT_SHAPE', facility.BED_ASSIGNMENT_SHAPE)
  + emit('OCCUPANCY_GUARDS', facility.OCCUPANCY_GUARDS) + emit('OCCUPANCY_VIEW', facility.OCCUPANCY_VIEW);

// dokument czytelny dla człowieka
const md = [];
md.push('# Kontrakty Silver Care — wygenerowane\n');
md.push('Ten plik powstaje z `contracts/`. Nie edytuj go ręcznie.\n');
md.push(`## Role (${roles.ROLES.length})\n`);
md.push('| Rola | Zakres | Opis |', '|---|---|---|');
for (const r of roles.ROLES) md.push(`| \`${r.id}\` | ${r.scope} | ${r.desc} |`);
md.push(`\n**Zgodę na dane o zdrowiu mogą wyrazić:** ${roles.CONSENT_GRANTORS.map((g) => `\`${g}\``).join(', ')}. Rola \`family\` świadomie poza tą listą (ADR-003).\n`);
md.push(`## Granica MDR — co widzą bliscy (ADR-005, wariant B)\n`);
md.push('| Metryka | Jednostka | Rodzaj |', '|---|---|---|');
for (const m of pres.FAMILY_VISIBLE_METRICS) md.push(`| \`${m.id}\` | ${m.unit} | ${m.kind} |`);
md.push(`\n**Ukryte przed bliskimi (${pres.PHYSIOLOGICAL_FIELDS.length} pól fizjologicznych):** ${pres.PHYSIOLOGICAL_FIELDS.map((f) => `\`${f}\``).join(', ')}.\n`);
md.push('Dane są zbierane i dostępne personelowi. Zakaz dotyczy prezentacji bliskim, nie przechowywania.\n');
md.push(`## Potok głosowy\n`);
md.push('| Etap | Wykonawca | Wejście | Wyjście |', '|---|---|---|---|');
for (const s of voice.PIPELINE_STAGES) md.push(`| ${s.id} | ${s.actor} | ${s.input} | ${s.output} |`);
md.push(`\n## Powiadomienia (${notif.NOTIFICATIONS.length})\n`);
md.push('| ID | Wyzwalacz | Odbiorca | Kanały |', '|---|---|---|---|');
for (const n of notif.NOTIFICATIONS) md.push(`| ${n.id} | \`${n.trigger}\` | ${n.recipient} | ${n.channels.join(', ')} |`);
md.push(`\n**Zakazane wyzwalacze:** ${notif.FORBIDDEN_TRIGGERS.map((t) => `\`${t.trigger}\``).join(', ')} — powiadomienie oparte na metryce czyni system narzędziem monitorowania stanu.\n`);
md.push(`## Rejestr pokoi i łóżek (ADR-012)\n`);
md.push(`Hierarchia: ${facility.FACILITY_HIERARCHY.join(' → ')}\n`);
md.push('| Guard | Reakcja na naruszenie |', '|---|---|');
for (const g of facility.OCCUPANCY_GUARDS) md.push(`| \`${g.id}\` | ${g.onViolation} |`);
md.push(`\n${facility.BED_ASSIGNMENT_SHAPE.invariant}\n`);
md.push(`## Autonomia agentów (ADR-010)\n`);
md.push('| Klasa | Tryb | Kiedy |', '|---|---|---|');
for (const c of auto.DECISION_CLASSES) md.push(`| \`${c.id}\` | ${c.mode} | ${c.desc} |`);
md.push(`\n**Zawsze pytają człowieka:** ${auto.ESCALATION_TRIGGERS.map((t) => `\`${t.id}\``).join(', ')}.\n`);
md.push(`## System projektowy (ADR-011)\n`);
md.push(`Krój: \`${design.TYPOGRAPHY.fontStack}\`\n`);
md.push(`Bazowy rozmiar ${design.TYPOGRAPHY.baseSize} · minimalny kontrast ${design.ACCESSIBILITY.contrastMinimum}:1 · cel dotykowy ${design.ACCESSIBILITY.touchTargetMinimum}\n`);
md.push(`## Wymagania (${reqs.REQUIREMENTS.length})\n`);
md.push('| ID | Domena | Ryzyko | Treść |', '|---|---|---|---|');
for (const r of reqs.REQUIREMENTS) md.push(`| ${r.id} | ${r.domain} | ${r.risk} | ${r.statement} |`);
files['docs/architecture/generated/CONTRACTS.md'] = md.join('\n') + '\n';

let drift = 0;
for (const [rel, content] of Object.entries(files)) {
  const abs = join(ROOT, rel);
  if (CHECK) {
    const cur = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
    if (cur !== content) { console.log(`  ✗ DRYF: ${rel}`); drift++; }
  } else {
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
}
if (CHECK) {
  if (drift) { console.log(`\n  ${drift} plik(ów) rozjechało się z kontraktem. Uruchom: node tools/sc-codegen.mjs`); process.exit(1); }
  console.log(`  ✓ Artefakty zgodne z kontraktem (${Object.keys(files).length} plików).`);
} else {
  console.log(`  ✓ Wygenerowano ${Object.keys(files).length} plików.`);
}
