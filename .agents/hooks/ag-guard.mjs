#!/usr/bin/env node
/**
 * ag-guard — adapter hooków Antigravity dla bramki Silver Care.
 *
 * Antigravity woła PreToolUse z JSON-em na stdin i oczekuje JSON-a na stdout:
 *   wejście : { toolCall: { name, args }, workspacePaths: [...], ... }
 *   wyjście : { decision: "allow" | "deny" | "ask", reason: "..." }
 *
 * Claude Code używa innego kontraktu (exit 2 = blokada), dlatego logika reguł
 * Logika reguł mieszka w tools/guard-core.mjs, a ten plik tłumaczy wyłącznie format.
 * Ścieżki kontraktowe wymagają otwartego okna (tools/sc-contract-window.mjs),
 * a cykl wykonania pilnowany jest przez narzędzia fazowe (tools/sc-phase.mjs).
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { checkWrite, checkBash, projectRoot } from '../../tools/guard-core.mjs';
import { isAutoIssuePushAllowed, isGitPushCommand } from '../../tools/lib/auto-issue-core.mjs';

const out = (decision, reason) => {
  process.stdout.write(JSON.stringify(reason ? { decision, reason } : { decision }));
  process.exit(0);
};

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  out('allow'); // nie blokujemy z powodu własnego błędu parsowania
}

// Antigravity podaje katalogi robocze — użyj pierwszego jako korzenia, jeśli nie ustawiono jawnie
if (!process.env.SC_PROJECT_DIR && Array.isArray(input.workspacePaths) && input.workspacePaths[0]) {
  process.env.SC_PROJECT_DIR = input.workspacePaths[0];
}

const name = input?.toolCall?.name || '';
const args = input?.toolCall?.args || {};

// ── Zapis do pliku ────────────────────────────────────────────────────────
if (name === 'write_to_file' || name === 'replace_file_content' || name === 'multi_replace_file_content') {
  const path = args.TargetFile || '';
  const chunks = Array.isArray(args.ReplacementChunks)
    ? args.ReplacementChunks.map((c) => c?.ReplacementContent || c?.TargetContent || '').join('\n')
    : '';
  const content = [args.CodeContent, args.ReplacementContent, chunks].filter(Boolean).join('\n');

  // enforceContract: true — zapis idzie od agenta. Ścieżki kontraktowe wymagają otwartego okna,
  // co zapobiega przypadkowej modyfikacji kontraktu bez procedury contract-window.
  const verdict = checkWrite(path, content, { enforceContract: true });
  if (verdict.blocked) out('deny', `BRAMKA SILVER CARE — ${verdict.reason}`);
  out('allow');
}

function extractRepoDir(cmd, fallbackDir) {
  const m = /(?:^|\s)git\s+-C\s+(?:"([^"]+)"|'([^']+)'|([^\s]+))/.exec(cmd);
  const raw = m ? (m[1] || m[2] || m[3]) : null;
  return raw ? resolve(fallbackDir, raw) : fallbackDir;
}
function tryAuthorizeAutoPush(cmd, fallbackDir) {
  const repoDir = extractRepoDir(cmd, fallbackDir);
  try {
    const git = (a) => execFileSync('git', ['-C', repoDir, ...a], { encoding: 'utf8' }).trim();
    const currentBranch = git(['branch', '--show-current']);
    const headSha = git(['rev-parse', 'HEAD']);
    const receiptPath = resolve(repoDir, git(['rev-parse', '--git-dir']), 'sc-codex-approved.json');
    let receipt = null;
    if (existsSync(receiptPath)) {
      try { receipt = JSON.parse(readFileSync(receiptPath, 'utf8')); } catch { receipt = null; }
    }
    return isAutoIssuePushAllowed({ commandLine: cmd, currentBranch, headSha, receipt });
  } catch (err) {
    return { allowed: false, reason: `Błąd odczytu stanu git: ${err?.message || 'nieznany błąd'}` };
  }
}

// ── Komenda w terminalu ───────────────────────────────────────────────────
if (name === 'run_command') {
  const cmd = args.CommandLine || '';
  const verdict = checkBash(cmd);
  if (verdict.blocked) out('deny', `BRAMKA SILVER CARE — ${verdict.reason}`);
  if (/\b(pnpm\s+publish|vercel|supabase\s+db\s+push|supabase\s+functions\s+deploy|prisma\s+migrate\s+deploy)\b/.test(cmd)) {
    out('force_ask', 'Operacja wychodząca poza maszynę lokalną — decyzja należy do człowieka.');
  }
  if (isGitPushCommand(cmd)) {
    const res = tryAuthorizeAutoPush(cmd, process.env.SC_PROJECT_DIR || projectRoot);
    if (res.allowed) out('allow');
    if (res.hardDeny) out('deny', `BRAMKA SILVER CARE — ${res.reason}`);
    out('force_ask', `Operacja wychodząca poza maszynę lokalną — ${res.reason}`);
  }
  out('allow');
}
out('allow');
