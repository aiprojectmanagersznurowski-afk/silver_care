#!/usr/bin/env node
/**
 * sc-codex-gate — local Codex CLI verification gate for autonomous issue execution.
 * Subcommands: healthcheck | plan-review | code-review
 */
import { accessSync, constants, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ESCALATION_TRIGGERS, RETRY_POLICY } from '../contracts/autonomy.contract.mjs';
import { AUTO_BRANCH_RE, validateCodexVerdict } from './lib/auto-issue-core.mjs';

const DEFAULT_CODEX_APP_BIN = '/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex';
const MAX_DIFF_BYTES = 120 * 1024;

function isExecutable(p) {
  if (!p) return false;
  try { accessSync(p, constants.X_OK); return true; } catch { return false; }
}

export function resolveCodexBin() {
  if (isExecutable(process.env.CODEX_BIN)) return process.env.CODEX_BIN;
  const which = spawnSync('which', ['codex'], { encoding: 'utf8' });
  const pathBin = which.status === 0 ? which.stdout.trim().split('\n')[0] : '';
  if (isExecutable(pathBin)) return pathBin;
  if (isExecutable(DEFAULT_CODEX_APP_BIN)) return DEFAULT_CODEX_APP_BIN;
  return null;
}

const BOOL_FLAGS = new Set(['json', 'verify-passed']);

function parseFlags(argv) {
  const flags = {};
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { rest.push(a); continue; }
    const key = a.slice(2);
    if (BOOL_FLAGS.has(key)) { flags[key] = true; continue; }
    if (i + 1 < argv.length) flags[key] = argv[++i];
    else flags[key] = true;
  }
  return { cmd: rest[0], flags };
}

function makeSchema(verdicts) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['verdict', 'summary', 'blocking_issues', 'contract_impact', 'suggestions'],
    properties: {
      verdict: { type: 'string', enum: verdicts },
      summary: { type: 'string' },
      blocking_issues: { type: 'array', items: { type: 'string' } },
      contract_impact: { type: 'boolean' },
      suggestions: { type: 'array', items: { type: 'string' } },
    },
  };
}

function runCodexStructured({ bin, repo, prompt, verdicts, mode, timeoutMs }) {
  const dir = mkdtempSync(join(tmpdir(), 'sc-codex-gate-'));
  const schemaPath = join(dir, 'schema.json');
  const outPath = join(dir, 'out.json');
  try {
    writeFileSync(schemaPath, JSON.stringify(makeSchema(verdicts), null, 2));
    const res = spawnSync(
      bin,
      ['exec', '-s', 'read-only', '--ephemeral', '--color', 'never', '-C', repo, '--output-schema', schemaPath, '-o', outPath, '-'],
      { input: prompt, encoding: 'utf8', timeout: timeoutMs, maxBuffer: 10 * 1024 * 1024 },
    );
    if (res.error) throw res.error;
    if (res.status !== 0) throw new Error(`Codex exited ${res.status}: ${(res.stderr || res.stdout || '').slice(-600)}`);
    const raw = readFileSync(outPath, 'utf8').trim();
    const parsed = JSON.parse(raw);
    const check = validateCodexVerdict(parsed, mode);
    if (!check.valid) throw new Error(`Invalid Codex schema payload: ${check.error}`);
    return check.value;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runHealthcheck(asJson) {
  const bin = resolveCodexBin();
  const t0 = Date.now();
  if (!bin) {
    const out = { ok: false, bin: null, error: 'Codex CLI binary not found (PATH or ChatGPT.app).' };
    console.log(asJson ? JSON.stringify(out, null, 2) : `✗ Codex: ${out.error}`);
    process.exit(1);
  }
  const dir = mkdtempSync(join(tmpdir(), 'sc-codex-ping-'));
  const outPath = join(dir, 'ping.txt');
  try {
    const version = execFileSync(bin, ['--version'], { encoding: 'utf8', timeout: 10000 }).trim();
    const res = spawnSync(
      bin,
      ['exec', '-s', 'read-only', '--ephemeral', '--color', 'never', '-o', outPath, 'Reply with exactly OK'],
      { encoding: 'utf8', timeout: 45000 },
    );
    const reply = existsSync(outPath) ? readFileSync(outPath, 'utf8').trim() : '';
    const latencyMs = Date.now() - t0;
    const ok = res.status === 0 && /\bOK\b/.test(reply);
    const payload = {
      ok, bin, version, latencyMs, reply,
      maxRounds: RETRY_POLICY.maxAttemptsPerProblem,
      ...(ok ? {} : { error: (res.stderr || res.stdout || `status=${res.status}`).trim().slice(-400) }),
    };
    console.log(asJson ? JSON.stringify(payload, null, 2) : `${ok ? '✓' : '✗'} Codex (${version}, ${latencyMs}ms): ${reply || payload.error}`);
    process.exit(ok ? 0 : 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runPlanReview(flags) {
  const bin = resolveCodexBin();
  if (!bin) throw new Error('Codex CLI binary not found.');
  const repo = resolve(String(flags.repo || process.cwd()));
  const issue = String(flags.issue || '');
  const planText = readFileSync(resolve(String(flags['plan-file'])), 'utf8');
  const issueText = flags['issue-file'] && existsSync(resolve(String(flags['issue-file'])))
    ? readFileSync(resolve(String(flags['issue-file'])), 'utf8')
    : '';
  const escalationList = ESCALATION_TRIGGERS.map((t) => `- ${t.id}: ${t.desc}`).join('\n');
  const prompt = [
    `Review the implementation and test plan for Silver Care GitHub Issue #${issue}.`,
    'Return APPROVED only if the plan & test specification are complete, unambiguous, and safe.',
    'Return BLOCKED_CONTRACT if changing contracts/*.contract.mjs or opening a contract window is needed.',
    'Return BLOCKED_AMBIGUOUS if acceptance criteria contradict existing contracts or require human product decision.',
    'Return REVISE if tests/plan have fixable technical gaps.',
    '',
    'Mandatory Silver Care guardrails:',
    '- Contract immutability without open window; never relax gate rules.',
    '- MDR / GDPR Art. 9: never leak medical/physiological metrics to family views, never use "pacjent", no raw PII in logs or LLM.',
    '- App code files <= 250 LOC; no `as any` / `@ts-ignore`; UI must follow PageHeader/StatusBadge/TableCard/ListEmpty.',
    '- Tests must carry `@REQ: <ID>` tags; frontend `apps/web` changes require Playwright E2E POM specs in `e2e/`.',
    `Escalation triggers:\n${escalationList}`,
    issueText ? `\n=== ISSUE #${issue} ===\n${issueText}` : '',
    `\n=== PROPOSED PLAN & TESTS ===\n${planText}`,
  ].join('\n');

  const result = runCodexStructured({
    bin, repo, prompt,
    verdicts: ['APPROVED', 'REVISE', 'BLOCKED_CONTRACT', 'BLOCKED_AMBIGUOUS'],
    mode: 'plan-review',
    timeoutMs: 300000,
  });
  console.log(flags.json ? JSON.stringify(result, null, 2) : `${result.verdict}: ${result.summary}`);
  process.exit(0);
}

function runCodeReview(flags) {
  const bin = resolveCodexBin();
  if (!bin) throw new Error('Codex CLI binary not found.');
  const repo = resolve(String(flags.repo || process.cwd()));
  const issue = Number(flags.issue);
  const base = String(flags.base || 'origin/staging');
  const verifyPassed = Boolean(flags['verify-passed']);
  const verifySummary = String(flags['verify-summary'] || (verifyPassed ? 'verify.sh --full passed' : 'not provided'));

  const dirty = execFileSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf8' }).trim();
  if (dirty) throw new Error('Working tree is dirty. Commit or clean changes before running code-review.');
  const headSha = execFileSync('git', ['-C', repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const branch = execFileSync('git', ['-C', repo, 'branch', '--show-current'], { encoding: 'utf8' }).trim();
  const diffStat = execFileSync('git', ['-C', repo, 'diff', '--stat', `${base}...HEAD`], { encoding: 'utf8' }).trim();
  let diff = execFileSync('git', ['-C', repo, 'diff', `${base}...HEAD`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (Buffer.byteLength(diff, 'utf8') > MAX_DIFF_BYTES) {
    diff = `${diff.slice(0, MAX_DIFF_BYTES)}\n\n[DIFF TRUNCATED AT 120KB — inspect repo files directly if needed]`;
  }

  const prompt = [
    `Perform a strict final code review for Silver Care GitHub Issue #${issue} on branch '${branch}' against '${base}'.`,
    `Verification report: ${verifySummary}`,
    'Check correctness, missing edge cases/tests (@REQ tags, E2E POM for apps/web), security/RLS isolation, GDPR Art. 9 / MDR compliance, <= 250 LOC per file, and ensure contracts/*.contract.mjs were NOT touched.',
    'Return APPROVED only if production-ready with zero blocking defects.',
    'Return BLOCKED_CONTRACT if contract change is required.',
    'Return CHANGES_REQUESTED with concrete actionable items in blocking_issues otherwise.',
    `\n=== DIFF STAT ===\n${diffStat}`,
    `\n=== GIT DIFF (${base}...HEAD) ===\n${diff}`,
  ].join('\n');

  const result = runCodexStructured({
    bin, repo, prompt,
    verdicts: ['APPROVED', 'CHANGES_REQUESTED', 'BLOCKED_CONTRACT'],
    mode: 'code-review',
    timeoutMs: 360000,
  });

  let receiptPath = null;
  if (result.verdict === 'APPROVED' && verifyPassed && AUTO_BRANCH_RE.test(branch)) {
    const rawGitDir = execFileSync('git', ['-C', repo, 'rev-parse', '--git-dir'], { encoding: 'utf8' }).trim();
    const gitDir = resolve(repo, rawGitDir);
    receiptPath = join(gitDir, 'sc-codex-approved.json');
    const receipt = {
      commitSha: headSha, branch, baseBranch: base, issueNumber: issue,
      verdict: 'APPROVED', verifyPassed: true, approvedAt: new Date().toISOString(),
      summary: result.summary, blocking_issues: [],
    };
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2));
  }

  const output = { ...result, commitSha: headSha, branch, ...(receiptPath ? { receiptPath } : {}) };
  console.log(flags.json ? JSON.stringify(output, null, 2) : `${output.verdict} (${headSha.slice(0, 7)}): ${output.summary}`);
}

const { cmd, flags } = parseFlags(process.argv.slice(2));
try {
  if (cmd === 'healthcheck') runHealthcheck(Boolean(flags.json));
  else if (cmd === 'plan-review') runPlanReview(flags);
  else if (cmd === 'code-review') runCodeReview(flags);
  else {
    console.error('Usage: node tools/sc-codex-gate.mjs <healthcheck|plan-review|code-review> [options]');
    process.exit(2);
  }
} catch (err) {
  const msg = err?.message || String(err);
  if (flags.json) console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
  else console.error(`✗ sc-codex-gate error: ${msg}`);
  process.exit(1);
}
