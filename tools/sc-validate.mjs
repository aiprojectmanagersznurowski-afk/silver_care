#!/usr/bin/env node
/**
 * sc-validate — sprawdza wewnętrzną spójność kontraktów Silver Care.
 *
 * Reguła bez dowodu, że potrafi coś zablokować, jest dekoracją. Każda reguła
 * tutaj ma odpowiadającą mutację w sc-selftest.mjs.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.env.SC_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (f) => import(`file://${join(ROOT, 'contracts', f)}`);

const { ROLES, STAFF_ROLES, RELATIVE_ROLES, MFA_REQUIRED_ROLES, CONSENT_GRANTORS, CONSENT_PURPOSES,
        RESOURCES, MATRIX, AUDIT_REQUIREMENTS, DELETE_POLICIES } = await load('roles.contract.mjs');
const { FAMILY_VISIBLE_METRICS, PHYSIOLOGICAL_FIELDS, FORBIDDEN_UI_TERMS, MDR_GUARDRAILS,
        REQUIRED_UI_STATES } = await load('presentation.contract.mjs');
const { TRANSCRIPT_STREAMS, MEDICAL_CATEGORIES, PIPELINE_STAGES, VOICE_RETENTION,
        AI_PROVENANCE_FIELDS, AI_FEEDBACK_CATEGORIES } = await load('voice.contract.mjs');
const { PROVIDERS, WEARABLE_LINK, ORG_LINK, FIELD_MAPPINGS, INGEST_PRECONDITIONS, SYNC_STALENESS } = await load('integration.contract.mjs');
const { NOTIFICATIONS, FORBIDDEN_TRIGGERS, CHANNELS, RECIPIENTS, QUEUE_POLICY } = await load('notifications.contract.mjs');
const { REQUIREMENTS, REQUIREMENTS_BY_ID } = await load('requirements.contract.mjs');
const { DECISION_CLASSES, ESCALATION_TRIGGERS, DEFAULTS, RETRY_POLICY, SESSION_REPORT_SECTIONS } = await load('autonomy.contract.mjs');
const { FACILITY_HIERARCHY, ROOM_SHAPE, BED_SHAPE, BED_ASSIGNMENT_SHAPE, OCCUPANCY_GUARDS, OCCUPANCY_VIEW } = await load('facility.contract.mjs');
const { TYPOGRAPHY, COLORS, SPACING, ACCESSIBILITY, LAYOUT_PRINCIPLES } = await load('design.contract.mjs');

const errors = [];
const warns = [];
const err = (rule, msg) => errors.push(`[${rule}] ${msg}`);
const warn = (rule, msg) => warns.push(`[${rule}] ${msg}`);

const roleIds = ROLES.map((r) => r.id);
const reqIds = new Set(REQUIREMENTS.map((r) => r.id));

// R01 — role rozłączne i kompletne
for (const r of [...STAFF_ROLES, ...RELATIVE_ROLES]) {
  if (!roleIds.includes(r)) err('R01-roles', `Rola "${r}" nie istnieje w ROLES.`);
}
if (STAFF_ROLES.some((r) => RELATIVE_ROLES.includes(r))) {
  err('R01-roles', 'Rola występuje jednocześnie jako personel i bliski.');
}

// R02 — zgodę na dane o zdrowiu mogą wyrażać wyłącznie uprawnione podmioty (ADR-003)
if (CONSENT_GRANTORS.includes('family')) {
  err('R02-consent-grantor', 'Rola family na liście CONSENT_GRANTORS. Zgodę na dane art. 9 może wyrazić wyłącznie pensjonariusz albo opiekun prawny.');
}
if (!CONSENT_GRANTORS.includes('legal_guardian')) {
  err('R02-consent-grantor', 'Brak legal_guardian wśród CONSENT_GRANTORS — nikt nie mógłby wyrazić zgody za osobę ubezwłasnowolnioną.');
}
const consentRow = MATRIX.find((m) => m.resource === 'consent_ledger');
if (consentRow) {
  const writers = [...(consentRow.create || []), ...(consentRow.update || [])].map((c) => c.split(':')[0]);
  for (const w of writers) {
    if (RELATIVE_ROLES.includes(w) && !CONSENT_GRANTORS.includes(w)) {
      err('R02-consent-grantor', `Rola "${w}" może zapisywać w consent_ledger, a nie jest uprawniona do wyrażania zgody.`);
    }
  }
}

// R03 — rejestr zgód niezmienialny (ADR-003)
if (consentRow && ((consentRow.update || []).length || (consentRow.delete || []).length)) {
  err('R03-consent-immutable', 'consent_ledger ma przyznane update lub delete. Cofnięcie zgody to nowy stan przez revoked_at, nie edycja historii.');
}

// R04 — granica MDR: metryki widoczne rodzinie nie mogą być fizjologiczne (ADR-005)
const physio = new Set(PHYSIOLOGICAL_FIELDS);
for (const m of FAMILY_VISIBLE_METRICS) {
  if (m.kind !== 'BEHAVIORAL') {
    err('R04-mdr-family-metrics', `Metryka "${m.id}" widoczna rodzinie ma rodzaj ${m.kind}. Wariant B dopuszcza wyłącznie BEHAVIORAL.`);
  }
  const leaf = String(m.source).split('.').pop();
  if (physio.has(leaf) || physio.has(m.id)) {
    err('R04-mdr-family-metrics', `Metryka "${m.id}" jest polem fizjologicznym i nie może być prezentowana bliskim.`);
  }
}

// R05 — mapowania integracji zgodne z granicą prezentacji (ADR-002 + ADR-005)
const familyVisibleIds = new Set(FAMILY_VISIBLE_METRICS.map((m) => m.id));
for (const f of FIELD_MAPPINGS) {
  if (f.familyVisible && f.kind !== 'BEHAVIORAL') {
    err('R05-mapping-visibility', `Mapowanie "${f.canonical}" oznaczone jako widoczne rodzinie, a ma rodzaj ${f.kind}.`);
  }
  if (f.familyVisible && !familyVisibleIds.has(f.canonical)) {
    err('R05-mapping-visibility', `Mapowanie "${f.canonical}" deklaruje widoczność dla rodziny, ale nie ma go w FAMILY_VISIBLE_METRICS.`);
  }
  if (!f.familyVisible && familyVisibleIds.has(f.canonical)) {
    err('R05-mapping-visibility', `Niespójność: "${f.canonical}" jest w FAMILY_VISIBLE_METRICS, a mapowanie oznacza go jako ukryte.`);
  }
}

// R06 — rdzeń odseparowany od dostawców (ADR-002)
for (const key of WEARABLE_LINK.externalKeys) {
  if (!/^external_|^provider$/.test(key)) {
    err('R06-core-decoupled', `Klucz zewnętrzny "${key}" w warstwie integracyjnej nie ma prefiksu external_ ani nie jest polem provider.`);
  }
}
if (WEARABLE_LINK.coreKey !== 'resident_id' || ORG_LINK.coreKey !== 'organization_id') {
  err('R06-core-decoupled', 'Warstwa integracyjna musi wiązać się z rdzeniem przez resident_id i organization_id.');
}
const activeProviders = PROVIDERS.filter((p) => p.status === 'ACTIVE');
for (const p of activeProviders) {
  if (p.region === 'UNKNOWN') {
    err('R06-core-decoupled', `Dostawca "${p.id}" jest ACTIVE przy nieustalonej lokalizacji przetwarzania. Dane art. 9 nie mogą opuścić EOG.`);
  }
}

// R22 — transfer danych poza EOG wymaga JAWNIE udokumentowanego wyjątku (ADR-009).
// Sam region różny od EU nie jest błędem — ale bez zgody, uzasadnienia i mechanizmu
// transferu byłby to cichy kompromis, a nie decyzja. To rozróżnia "region: US"
// od "region: UNKNOWN": pierwsze wymaga papierów, drugie jest po prostu zakazane.
for (const p of activeProviders) {
  const isEU = /^EU/.test(p.region);
  if (!isEU && p.region !== 'UNKNOWN') {
    if (!p.transferMechanism) err('R22-transfer-exception', `Dostawca "${p.id}" przetwarza dane poza EOG (region: ${p.region}) bez zadeklarowanego mechanizmu transferu.`);
    if (!p.exceptionApprovedBy) err('R22-transfer-exception', `Dostawca "${p.id}" poza EOG bez odnotowanej zgody na wyjątek.`);
    if (!p.exceptionReason || p.exceptionReason.length < 40) err('R22-transfer-exception', `Dostawca "${p.id}" poza EOG ma zbyt ogólne uzasadnienie wyjątku.`);
  }
}

// R07 — potok głosowy: redakcja przed modelem (ADR-007)
const stageOrder = PIPELINE_STAGES.map((s) => s.id);
const iRedact = stageOrder.indexOf('REDACT');
const iGenerate = stageOrder.indexOf('GENERATE');
const iClassify = stageOrder.indexOf('CLASSIFY');
if (iRedact === -1 || iGenerate === -1) {
  err('R07-redact-before-llm', 'Potok głosowy musi mieć etapy REDACT i GENERATE.');
} else if (iRedact > iGenerate) {
  err('R07-redact-before-llm', 'Etap REDACT występuje po GENERATE. Dane medyczne trafiłyby do modelu.');
}
if (iClassify > iGenerate) {
  err('R07-redact-before-llm', 'Klasyfikacja strumieni musi poprzedzać generowanie raportu.');
}
const medicalStream = TRANSCRIPT_STREAMS.find((s) => s.id === 'MEDICAL');
if (!medicalStream) {
  err('R07-redact-before-llm', 'Brak strumienia MEDICAL w TRANSCRIPT_STREAMS.');
} else {
  if (medicalStream.reachesLLM) {
    err('R07-redact-before-llm', 'Strumień MEDICAL oznaczony jako docierający do modelu. Dane medyczne mają być usunięte przed wysłaniem.');
  }
  for (const a of medicalStream.audience) {
    if (RELATIVE_ROLES.includes(a)) {
      err('R07-redact-before-llm', `Strumień MEDICAL dostępny roli "${a}". Brudnopis medyczny jest wyłącznie dla personelu.`);
    }
  }
}
if (!MEDICAL_CATEGORIES.length) err('R07-redact-before-llm', 'Pusta lista kategorii medycznych — klasyfikator nie miałby czego wykrywać.');

// R08 — zero-guessing (ADR-006)
const capture = PIPELINE_STAGES.find((s) => s.id === 'CAPTURE');
if (capture && !/resident_id/.test(capture.input)) {
  err('R08-zero-guessing', 'Etap CAPTURE nie przyjmuje resident_id. Model musiałby ustalać tożsamość z nagrania.');
}
const generate = PIPELINE_STAGES.find((s) => s.id === 'GENERATE');
if (generate && !/anonim/i.test(generate.input)) {
  err('R08-zero-guessing', 'Etap GENERATE nie deklaruje anonimowego wejścia.');
}
const rejoin = PIPELINE_STAGES.find((s) => s.id === 'REJOIN');
if (rejoin && stageOrder.indexOf('REJOIN') < iGenerate) {
  err('R08-zero-guessing', 'Złączenie z tożsamością następuje przed generowaniem — transkrypt nie byłby anonimowy.');
}

// R09 — publikacja raportu wymaga człowieka
const approve = PIPELINE_STAGES.find((s) => s.id === 'APPROVE');
if (!approve) err('R09-human-approval', 'Brak etapu APPROVE. Raport trafiałby do bliskich bez zatwierdzenia.');
else if (approve.actor !== 'nurse' && approve.actor !== 'org_admin') {
  err('R09-human-approval', `Etap APPROVE wykonuje "${approve.actor}". Publikacja musi należeć do człowieka.`);
}
for (const f of ['ai_model', 'ai_prompt_version', 'approved_by']) {
  if (!AI_PROVENANCE_FIELDS.includes(f)) err('R09-human-approval', `Brak pola pochodzenia AI: ${f}.`);
}

// R10 — powiadomienia nie wyzwalane metryką (ADR-005)
const forbiddenTriggerIds = new Set(FORBIDDEN_TRIGGERS.map((t) => t.trigger));
const allowedTriggers = new Set(MDR_GUARDRAILS.notificationTriggers);
for (const n of NOTIFICATIONS) {
  if (forbiddenTriggerIds.has(n.trigger)) {
    err('R10-no-metric-alarm', `Powiadomienie ${n.id} używa zakazanego wyzwalacza "${n.trigger}".`);
  }
  if (n.domain === 'FAMILY' && n.trigger !== 'daily_report_published' && !/invitation|revoked/.test(n.trigger)) {
    err('R10-no-metric-alarm', `Powiadomienie ${n.id} do rodziny wyzwalane przez "${n.trigger}". Do bliskich wychodzi wyłącznie informacja o raporcie, zaproszeniu i cofnięciu dostępu.`);
  }
  if (n.containsPersonalData) {
    err('R10-no-metric-alarm', `Powiadomienie ${n.id} deklaruje dane osobowe w treści (ADR-008).`);
  }
}
if (!allowedTriggers.has('daily_report_published')) {
  err('R10-no-metric-alarm', 'MDR_GUARDRAILS nie dopuszcza wyzwalacza publikacji raportu — nie zostałoby wysłane żadne powiadomienie.');
}

// R11 — katalog powiadomień spójny
const nIds = new Set();
for (const n of NOTIFICATIONS) {
  if (nIds.has(n.id)) err('R11-notif-shape', `Zduplikowany identyfikator powiadomienia ${n.id}.`);
  nIds.add(n.id);
  for (const c of n.channels) if (!CHANNELS.includes(c)) err('R11-notif-shape', `${n.id}: nieznany kanał "${c}".`);
  if (!RECIPIENTS.includes(n.recipient)) err('R11-notif-shape', `${n.id}: nieznany odbiorca "${n.recipient}".`);
  if (!n.templateKey) err('R11-notif-shape', `${n.id}: brak klucza szablonu.`);
  for (const r of n.req || []) if (!reqIds.has(r)) err('R11-notif-shape', `${n.id}: odwołanie do nieistniejącego wymagania "${r}".`);
  if (!(n.req || []).length) err('R11-notif-shape', `${n.id}: brak powiązania z wymaganiem.`);
}

// R12 — macierz uprawnień
for (const row of MATRIX) {
  if (!RESOURCES.includes(row.resource)) err('R12-rbac', `MATRIX: nieznany zasób "${row.resource}".`);
  for (const cap of ['read', 'create', 'update', 'delete']) {
    for (const entry of row[cap] || []) {
      const role = entry.split(':')[0];
      if (!roleIds.includes(role)) err('R12-rbac', `MATRIX ${row.resource}.${cap}: nieznana rola "${role}".`);
    }
  }
}
for (const res of RESOURCES) {
  if (!MATRIX.find((m) => m.resource === res)) err('R12-rbac', `Zasób "${res}" nie ma wiersza w macierzy.`);
}

// R13 — brudnopis personelu niedostępny bliskim
const logsRow = MATRIX.find((m) => m.resource === 'daily_logs');
if (logsRow) {
  for (const entry of logsRow.read || []) {
    if (RELATIVE_ROLES.includes(entry.split(':')[0])) {
      err('R13-draft-isolation', `daily_logs czytelne dla roli "${entry}". Brudnopis zawiera dane medyczne i jest wyłącznie dla personelu.`);
    }
  }
}
const voiceRow = MATRIX.find((m) => m.resource === 'voice_draft_notes');
if (voiceRow) {
  for (const entry of [...(voiceRow.read || []), ...(voiceRow.create || [])]) {
    if (RELATIVE_ROLES.includes(entry.split(':')[0])) {
      err('R13-draft-isolation', `voice_draft_notes dostępne roli "${entry}".`);
    }
  }
}

// R14 — audyt append-only
if (AUDIT_REQUIREMENTS.appendOnly) {
  const row = MATRIX.find((m) => m.resource === 'audit_logs');
  if (!row) err('R14-audit-append-only', 'Brak wiersza audit_logs w macierzy.');
  else {
    for (const cap of ['update', 'delete']) {
      if ((row[cap] || []).length) {
        err('R14-audit-append-only', `audit_logs.${cap} przyznane rolom [${row[cap].join(', ')}], a rejestr deklaruje append-only.`);
      }
    }
    if (!(row.create || []).length) err('R14-audit-append-only', 'Nikt nie może zapisać do audit_logs.');
  }
  if (!AUDIT_REQUIREMENTS.retentionDays) err('R14-audit-append-only', 'Brak okresu retencji rejestru audytowego.');
  if (AUDIT_REQUIREMENTS.requiresJustification && !AUDIT_REQUIREMENTS.legalBases?.length) {
    err('R14-audit-append-only', 'Wymagane uzasadnienie bez zamkniętej listy podstaw prawnych.');
  }
  for (const must of ['consent_grant', 'consent_revoke']) {
    if (!AUDIT_REQUIREMENTS.mustLog.includes(must)) {
      err('R14-audit-append-only', `Operacja "${must}" nie jest rejestrowana, a dotyczy podstawy prawnej przetwarzania.`);
    }
  }
}

// R15 — MFA dla personelu, nie dla rodzin
for (const r of MFA_REQUIRED_ROLES) {
  if (RELATIVE_ROLES.includes(r)) warn('R15-mfa-scope', `Rola bliskiego "${r}" wymaga MFA — sprawdź, czy to zamierzone.`);
  if (!roleIds.includes(r)) err('R15-mfa-scope', `MFA wymagane dla nieistniejącej roli "${r}".`);
}
for (const r of STAFF_ROLES) {
  if (!MFA_REQUIRED_ROLES.includes(r)) {
    err('R15-mfa-scope', `Rola personelu "${r}" bez wymogu MFA. Personel ma dostęp do danych art. 9.`);
  }
}

// R16 — warunki wstępne ingestu
const preIds = new Set(INGEST_PRECONDITIONS.map((p) => p.id));
for (const must of ['active_consent', 'resident_active', 'idempotency']) {
  if (!preIds.has(must)) err('R16-ingest-guard', `Brak warunku wstępnego ingestu: "${must}".`);
}

// R17 — retencja i TTL zadeklarowane
if (!VOICE_RETENTION.ttlDays) err('R17-retention', 'Brak TTL dla surowych nagrań głosowych.');
if (VOICE_RETENTION.ttlDays > 90) warn('R17-retention', `TTL nagrań ${VOICE_RETENTION.ttlDays} dni — długo jak na surowe audio z danymi wrażliwymi.`);

// R18 — słownictwo i stany interfejsu
if (!FORBIDDEN_UI_TERMS.find((t) => t.term === 'pacjent')) {
  err('R18-vocabulary', 'Słowo "pacjent" nie jest na liście zakazanych terminów interfejsu (ADR-004).');
}
for (const t of FORBIDDEN_UI_TERMS) {
  if (!t.replacement || !t.reason) err('R18-vocabulary', `Termin "${t.term}" bez zamiennika albo bez uzasadnienia.`);
}
for (const s of ['loading', 'empty', 'error']) {
  if (!REQUIRED_UI_STATES.includes(s)) err('R18-vocabulary', `Brak wymaganego stanu interfejsu "${s}".`);
}

// R19 — wymagania: unikalność, kryteria, poprawny status
const seenReq = new Set();
// DEFERRED: świadomie odłożone, nie zapomniane. Różni się od BLOCKED — nic nie
// blokuje realizacji, po prostu koszt/decyzja jest przesunięta na później.
// Wymaga deferredReason i deferredUntil, żeby "później" miało konkretny warunek,
// a nie ginęło bezterminowo w rejestrze.
const STATUSES = ['TODO', 'IN_PROGRESS', 'DONE', 'BLOCKED', 'DEFERRED'];
for (const r of REQUIREMENTS) {
  if (seenReq.has(r.id)) err('R19-req-shape', `Zduplikowane wymaganie "${r.id}".`);
  seenReq.add(r.id);
  if (!r.source) err('R19-req-shape', `${r.id}: brak źródła.`);
  if (!r.domain) err('R19-req-shape', `${r.id}: brak domeny.`);
  if (!r.statement) err('R19-req-shape', `${r.id}: brak treści.`);
  if (!(r.acceptance || []).length) err('R19-req-shape', `${r.id}: brak kryteriów akceptacji.`);
  if (!STATUSES.includes(r.status)) err('R19-req-shape', `${r.id}: nieznany status "${r.status}".`);
  if (r.status === 'BLOCKED') warn('R19-req-shape', `Wymaganie zablokowane luką kontraktu: ${r.id}`);
  if (r.status === 'DEFERRED') {
    if (!r.deferredReason) err('R19-req-shape', `${r.id}: status DEFERRED bez deferredReason. Bez uzasadnienia "odłożone" nie da się odróżnić od "zapomniane".`);
    if (!r.deferredUntil) err('R19-req-shape', `${r.id}: status DEFERRED bez deferredUntil. Potrzebny konkretny warunek powrotu, nie bezterminowe odłożenie.`);
    warn('R19-req-shape', `Wymaganie odłożone: ${r.id} — wraca przy: ${r.deferredUntil || '???'}`);
  }
}

// R20 — wymagania wysokiego ryzyka mają kryteria sprawdzalne, nie deklaratywne
for (const r of REQUIREMENTS.filter((x) => x.risk === 'HIGH')) {
  const vague = (r.acceptance || []).filter((a) => a.length < 25);
  if (vague.length) {
    err('R20-high-risk-testable', `${r.id}: kryterium zbyt ogólne, by je przetestować: "${vague[0]}".`);
  }
}

// R21 — okno wysyłki SMS nie obejmuje nocy
const sms = QUEUE_POLICY.sendWindow?.SMS || '';
const m = /^(\d{2}):\d{2}-(\d{2}):\d{2}$/.exec(sms);
if (!m) err('R21-send-window', `Nieczytelne okno wysyłki SMS: "${sms}".`);
else if (Number(m[1]) < 7 || Number(m[2]) > 21) {
  err('R21-send-window', `Okno SMS ${sms} obejmuje porę nocną. Powiadomienie o raporcie nie jest pilne.`);
}

// R23 — autonomia nie może obejmować decyzji nieodwracalnych (ADR-010).
// To jest reguła, która chroni wszystkie pozostałe: agent działający samodzielnie
// bez tej listy mógłby sam sobie poszerzyć uprawnienia.
{
  const classIds = DECISION_CLASSES.map((c) => c.id);
  for (const must of ['AUTO', 'ESCALATE']) {
    if (!classIds.includes(must)) err('R23-autonomy-limits', `Brak klasy decyzji "${must}".`);
  }
  const esc = DECISION_CLASSES.find((c) => c.id === 'ESCALATE');
  if (esc && esc.mode !== 'STOP_AND_ASK') {
    err('R23-autonomy-limits', 'Klasa ESCALATE nie zatrzymuje pracy. Autonomia bez zatrzymania to brak autonomii, tylko brak nadzoru.');
  }
  const trig = new Set(ESCALATION_TRIGGERS.map((t) => t.id));
  for (const must of ['contract_change', 'mdr_boundary', 'medical_category', 'consent_or_legal', 'external_provider', 'gate_relaxation', 'production_deploy']) {
    if (!trig.has(must)) err('R23-autonomy-limits', `Wyzwalacz eskalacji "${must}" usunięty. Ta decyzja nie może być podejmowana samodzielnie.`);
  }
  for (const t of ESCALATION_TRIGGERS) {
    if (!t.reason || t.reason.length < 20) err('R23-autonomy-limits', `Wyzwalacz "${t.id}" bez uzasadnienia — nie da się go zakwestionować ani obronić.`);
  }
  for (const d of DEFAULTS) {
    if (!d.choice || !d.rationale) err('R23-autonomy-limits', `Domyślne rozstrzygnięcie "${d.id}" bez wyboru albo uzasadnienia.`);
  }
  if (RETRY_POLICY.onExhausted !== 'ESCALATE') {
    err('R23-autonomy-limits', 'Wyczerpanie prób nie prowadzi do eskalacji — agent kręciłby się w kółko.');
  }
  if (!SESSION_REPORT_SECTIONS.find((x) => x.id === 'requires_decision')) {
    err('R23-autonomy-limits', 'Raport sesji nie ma sekcji z pytaniami wymagającymi decyzji.');
  }
}

// R24 — system projektowy spełnia próg dostępności (ADR-011).
// Odbiorcą jest często osoba starsza; minimalizm nie może kosztować czytelności.
{
  const base = parseInt(TYPOGRAPHY.baseSize, 10);
  if (!base || base < 16) err('R24-design-a11y', `Bazowy rozmiar tekstu ${TYPOGRAPHY.baseSize} jest za mały dla odbiorcy tego produktu (minimum 16px).`);
  for (const s of TYPOGRAPHY.scale) {
    if (parseInt(s.size, 10) < 13) err('R24-design-a11y', `Rozmiar "${s.id}" (${s.size}) poniżej progu czytelności 13px.`);
  }
  if (!/latin-ext/.test(TYPOGRAPHY.webfont.subset)) {
    err('R24-design-a11y', 'Krój bez zestawu latin-ext — polskie znaki diakrytyczne byłyby zastępowane.');
  }
  if (ACCESSIBILITY.contrastMinimum < 4.5) err('R24-design-a11y', `Minimalny kontrast ${ACCESSIBILITY.contrastMinimum} poniżej progu WCAG AA.`);
  if (parseInt(ACCESSIBILITY.touchTargetMinimum, 10) < 44) err('R24-design-a11y', 'Cel dotykowy poniżej 44px.');
  for (const tok of ['bg', 'surface', 'text', 'text-secondary', 'accent', 'border', 'focus']) {
    if (!COLORS.light[tok]) err('R24-design-a11y', `Brak tokenu koloru "${tok}" w motywie jasnym.`);
    if (!COLORS.dark[tok]) err('R24-design-a11y', `Brak tokenu koloru "${tok}" w motywie ciemnym.`);
  }
  if (!LAYOUT_PRINCIPLES.find((l) => l.id === 'quiet-metrics')) {
    err('R24-design-a11y', 'Brak zasady o cichej prezentacji metryk — wykres sugerujący trend narusza ADR-005.');
  }
}

// R25 — integralność obłożenia pokoi jest egzekwowana, nie tylko opisana (ADR-012).
{
  const guardIds = new Set(OCCUPANCY_GUARDS.map((g) => g.id));
  for (const must of ['bed_single_occupant', 'resident_single_bed', 'inactive_bed_no_assign', 'archived_resident_no_assign']) {
    if (!guardIds.has(must)) err('R25-occupancy-integrity', `Brak guarda obłożenia: "${must}". Bez niego dwie osoby mogłyby dostać to samo łóżko.`);
  }
  for (const g of OCCUPANCY_GUARDS) {
    if (g.onViolation !== 'REJECT') err('R25-occupancy-integrity', `Guard "${g.id}" nie odrzuca naruszenia (onViolation: ${g.onViolation}). Ciche pozwolenie na konflikt jest gorsze niż brak guarda — wygląda na zabezpieczone.`);
  }
  if (!BED_ASSIGNMENT_SHAPE.invariant || !/co najwyżej jedno/.test(BED_ASSIGNMENT_SHAPE.invariant)) {
    err('R25-occupancy-integrity', 'Brak jawnie zapisanego niezmiennika jeden-do-jednego dla przypisań łóżek.');
  }
  if (!BED_ASSIGNMENT_SHAPE.fields.find((f) => f.name === 'unassigned_at')) {
    err('R25-occupancy-integrity', 'Brak pola unassigned_at — przeniesienie kasowałoby historię zamiast ją zamykać.');
  }
  const roomsRow = MATRIX.find((m) => m.resource === 'rooms');
  const bedsRow = MATRIX.find((m) => m.resource === 'beds');
  const assignRow = MATRIX.find((m) => m.resource === 'bed_assignments');
  for (const [name, row] of [['rooms', roomsRow], ['beds', bedsRow], ['bed_assignments', assignRow]]) {
    if (!row) { err('R25-occupancy-integrity', `Brak wiersza RBAC dla "${name}".`); continue; }
    for (const entry of row.read || []) {
      if (RELATIVE_ROLES.includes(entry.split(':')[0])) {
        err('R25-occupancy-integrity', `"${name}" czytelne dla roli bliskiego "${entry}". Numer łóżka jest informacją logistyczną placówki, nie danymi udostępnianymi na zewnątrz bez wyraźnej potrzeby.`);
      }
    }
    if (!(row.create || []).includes('org_admin')) {
      err('R25-occupancy-integrity', `"${name}": org_admin nie może tworzyć rekordów — rejestr byłby niezarządzalny.`);
    }
  }
  if (!ROOM_SHAPE.uniqueness || !/organization_id.*number|number.*organization_id/.test(ROOM_SHAPE.uniqueness)) {
    err('R25-occupancy-integrity', 'Brak unikalności numeru pokoju w obrębie placówki — dwa pokoje mogłyby dzielić numer.');
  }
  if (!BED_SHAPE.uniqueness || !/room_id.*label|label.*room_id/.test(BED_SHAPE.uniqueness)) {
    err('R25-occupancy-integrity', 'Brak unikalności etykiety łóżka w obrębie pokoju.');
  }
  if (OCCUPANCY_VIEW.computedFrom && !/unassigned_at IS NULL/.test(OCCUPANCY_VIEW.computedFrom)) {
    err('R25-occupancy-integrity', 'Widok obłożenia nie filtruje po aktywnym przypisaniu — policzyłby też historyczne.');
  }
}

// ── raport ────────────────────────────────────────────────────────────────
console.log(`\n  role: ${ROLES.length} | zasoby: ${RESOURCES.length} | powiadomienia: ${NOTIFICATIONS.length} | wymagania: ${REQUIREMENTS.length}`);
console.log(`  pokoje: hierarchia ${FACILITY_HIERARCHY.join(' → ')}, guardów obłożenia: ${OCCUPANCY_GUARDS.length}`);
console.log(`  klasy decyzji: ${DECISION_CLASSES.length} | wyzwalacze eskalacji: ${ESCALATION_TRIGGERS.length} | domyślne: ${DEFAULTS.length}`);
console.log(`  metryki widoczne rodzinie: ${FAMILY_VISIBLE_METRICS.length} | pola fizjologiczne (ukryte): ${PHYSIOLOGICAL_FIELDS.length}`);
for (const w of warns) console.log(`  ⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log(`\n  BŁĘDÓW: ${errors.length}, OSTRZEŻEŃ: ${warns.length}\n`);
  process.exit(1);
}
console.log(`  ✓ Kontrakty spójne. Ostrzeżeń: ${warns.length}\n`);
