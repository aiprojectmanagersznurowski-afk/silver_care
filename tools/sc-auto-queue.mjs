#!/usr/bin/env node
/**
 * sc-auto-queue — pre-flight queue & canonical user stories checker for Darek.
 * Usage: node tools/sc-auto-queue.mjs [--assignee @me] [--base <branch>] [--include-codex] [--json]
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildQueueReport, parseStoriesMarkdown } from './lib/auto-issue-core.mjs';

const ROOT = process.env.SC_PROJECT_DIR || join(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  let assignee = '@me';
  let baseOverride = null;
  let includeCodex = false;
  let asJson = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--assignee' && argv[i + 1]) { assignee = argv[++i]; }
    else if (argv[i] === '--base' && argv[i + 1]) { baseOverride = argv[++i]; }
    else if (argv[i] === '--include-codex') includeCodex = true;
    else if (argv[i] === '--json') asJson = true;
  }
  return { assignee, baseOverride, includeCodex, asJson };
}

function getBaseBranch() {
  try {
    const ref = execFileSync('git', ['-C', ROOT, 'symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { encoding: 'utf8' }).trim();
    return ref.replace(/^origin\//, '') || 'staging';
  } catch {
    return 'staging';
  }
}

function isContractWindowOpen() {
  try {
    const p = join(ROOT, '.claude/state/contract-window.json');
    if (!existsSync(p)) return false;
    const w = JSON.parse(readFileSync(p, 'utf8'));
    if (!w.open) return false;
    return !w.expiresAt || Date.parse(w.expiresAt) > Date.now();
  } catch {
    return false;
  }
}

function runCodexHealthcheck() {
  const res = spawnSync(process.execPath, [join(ROOT, 'tools/sc-codex-gate.mjs'), 'healthcheck', '--json'], {
    cwd: ROOT, encoding: 'utf8', timeout: 50000,
  });
  try {
    return JSON.parse((res.stdout || '').trim());
  } catch {
    return { ok: false, error: (res.stderr || res.stdout || `exit ${res.status}`).trim().slice(-300) };
  }
}

function formatStoriesCell(item) {
  if (item.matchedStories.length) {
    return item.matchedStories.map((s) => `${s.id} (${s.statusEmoji || '?'})`).join(', ');
  }
  if (item.storyRefs.length) return item.storyRefs.map((id) => `${id} (brak w spec)`).join(', ');
  return 'brak powiązanego story';
}

function formatMarkdown(data) {
  const lines = [];
  if (data.codex) {
    const c = data.codex;
    lines.push(c.ok
      ? `**Codex lokalny:** OK (${c.version}, ${c.latencyMs}ms, max rund: ${c.maxRounds})`
      : `**Codex lokalny:** BŁĄD — ${c.error || 'nie odpowiada'}`);
  }
  lines.push(`**Gałąź bazowa:** \`${data.baseBranch}\` · **Okno kontraktowe:** ${data.contractWindowOpen ? 'OTWARTE' : 'zamknięte'}`);
  lines.push('');

  lines.push(`### Kolejka techniczna READY (${data.ready.length})`);
  if (!data.ready.length) {
    lines.push('_Brak gotowych technicznych issues bez blokerów._');
  } else {
    lines.push('| # | Tytuł | Story & Status | Priorytet / Etykiety | Uwagi |');
    lines.push('| :--- | :--- | :--- | :--- | :--- |');
    for (const item of data.ready) {
      const title = item.title.replace(/\|/g, '\\|');
      const labels = item.labels.join(', ') || '—';
      const notes = item.needsVerification ? '⚠️ do-weryfikacji' : 'gotowe';
      lines.push(`| #${item.number} | ${title} | ${formatStoriesCell(item)} | ${labels} | ${notes} |`);
    }
  }

  if (data.needsContract.length) {
    lines.push('');
    lines.push(`### Wymagają okna kontraktowego (${data.needsContract.length})`);
    for (const item of data.needsContract) {
      lines.push(`- #${item.number} ${item.title} — ${formatStoriesCell(item)} (${item.reason})`);
    }
  }

  if (data.excluded.length) {
    lines.push('');
    lines.push(`### Wykluczone z automatyzacji (${data.excluded.length})`);
    for (const item of data.excluded) {
      lines.push(`- #${item.number} ${item.title} — [${item.category}] ${item.reason}`);
    }
  }

  lines.push('');
  lines.push(data.recommended
    ? `**Rekomendacja na start:** #${data.recommended.number} — ${data.recommended.title}`
    : '**Rekomendacja na start:** brak kandydatów READY.');
  return lines.join('\n');
}

const { assignee, baseOverride, includeCodex, asJson } = parseArgs(process.argv.slice(2));
const codex = includeCodex ? runCodexHealthcheck() : null;
const baseBranch = baseOverride || getBaseBranch();
const contractWindowOpen = isContractWindowOpen();

const issuesRaw = execFileSync(
  'gh',
  ['issue', 'list', '--assignee', assignee, '--state', 'open', '--limit', '50', '--json', 'number,title,body,labels,url,createdAt'],
  { cwd: ROOT, encoding: 'utf8' },
);
const prsRaw = execFileSync(
  'gh',
  ['pr', 'list', '--state', 'open', '--limit', '50', '--json', 'number,title,headRefName,body,url'],
  { cwd: ROOT, encoding: 'utf8' },
);
const storiesPath = join(ROOT, 'docs/KANONICZNA_SPECYFIKACJA_USER_STORIES.md');
const storiesMd = existsSync(storiesPath) ? readFileSync(storiesPath, 'utf8') : '';
const storiesMap = parseStoriesMarkdown(storiesMd);

const report = buildQueueReport({
  issues: JSON.parse(issuesRaw),
  openPrs: JSON.parse(prsRaw),
  storiesMap,
  contractWindowOpen,
});

const output = { ...(codex ? { codex } : {}), baseBranch, contractWindowOpen, ...report };
console.log(asJson ? JSON.stringify(output, null, 2) : formatMarkdown(output));
if (codex && !codex.ok) process.exit(1);
