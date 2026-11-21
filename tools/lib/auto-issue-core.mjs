/**
 * Pure core helpers for autonomous Silver Care issue automation.
 * No filesystem or process I/O — safe to test directly in Vitest.
 */

export const AUTO_BRANCH_RE = /^auto\/issue-\d+-[a-z0-9-]+$/;
export const PROTECTED_BRANCHES = new Set(['main', 'master', 'staging']);
export const RECEIPT_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const POLISH_MAP = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ź: 'z', ż: 'z',
  Ą: 'A', Ć: 'C', Ę: 'E', Ł: 'L', Ń: 'N', Ó: 'O', Ś: 'S', Ź: 'Z', Ż: 'Z',
};

const STORY_HEADING_RE = /^#{2,4}\s+\[([A-Z0-9-]+)\]\s+(.+?)\s*$/;
const STORY_REF_RE = /\b(?:SC-[A-Z]+-\d+|TASK-[A-Z]+-\d+|NFR-[A-Z]+-\d+)\b/g;
const NON_CODE_LABELS = new Set(['question', 'wontfix', 'invalid', 'duplicate']);
const NON_CODE_TITLE_RE = /^\[(?:SPIKE|LEGAL)-/i;
const CONTRACT_NEED_RE = /(?:wymaga|potrzebuje|otworz\w*\s+okn\w*)\s+[^\n]*(?:contracts\/|contract-window|okn[oa]\s+kontrakt|nowe\s+@?REQ)|zmian[ayę]\s+w\s+contracts\/|contracts\/[a-z0-9_-]+\.contract\.mjs/i;
const STATUS_EMOJIS = ['✅', '🟡', '⏸️', '⏸', '❌', '📄', '🔭', '📝', '🚫'];
const ALLOWED_VERDICTS = {
  'plan-review': new Set(['APPROVED', 'REVISE', 'BLOCKED_CONTRACT', 'BLOCKED_AMBIGUOUS']),
  'code-review': new Set(['APPROVED', 'CHANGES_REQUESTED', 'BLOCKED_CONTRACT']),
};

export function buildAutoBranchName(issueNumber, title = '') {
  const num = Number(issueNumber);
  if (!Number.isInteger(num) || num <= 0) throw new Error(`Invalid issue number: ${issueNumber}`);
  const prefix = `auto/issue-${num}-`;
  const maxSlugLen = Math.max(8, 68 - prefix.length);
  const ascii = String(title)
    .replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, (ch) => POLISH_MAP[ch] || ch)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  let slug = ascii.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (slug.length > maxSlugLen) slug = slug.slice(0, maxSlugLen).replace(/-+$/g, '');
  return `${prefix}${slug || 'task'}`;
}

export function extractStoryRefs(text = '') {
  return [...new Set(String(text).match(STORY_REF_RE) || [])];
}

export function parseStoriesMarkdown(markdown = '') {
  const stories = new Map();
  let current = null;
  for (const line of String(markdown).split(/\r?\n/)) {
    const heading = STORY_HEADING_RE.exec(line.trim());
    if (heading) {
      current = { id: heading[1], title: heading[2].trim(), reqs: [], statusEmoji: '', statusRaw: '' };
      stories.set(current.id, current);
      continue;
    }
    if (!current || !line.includes('**Kontrakt:**')) continue;
    const contractSeg = line.split('**Kontrakt:**')[1].split(/·\s*\*\*(?:Work Order|WO|Status):/)[0] || '';
    current.reqs = [...new Set([...contractSeg.matchAll(/`([A-Z0-9-]+)`/g)].map((m) => m[1]))];
    const statusSeg = (line.split('**Status:**')[1] || '').trim();
    current.statusRaw = statusSeg;
    const found = STATUS_EMOJIS.find((e) => statusSeg.startsWith(e));
    current.statusEmoji = found === '⏸' ? '⏸️' : (found || '');
  }
  return stories;
}

export function classifyIssue(issue, ctx = {}) {
  const { openPrs = [], storiesMap = new Map(), contractWindowOpen = false } = ctx;
  const num = Number(issue.number);
  const title = String(issue.title || '');
  const body = String(issue.body || '');
  const labels = (issue.labels || []).map((l) => (typeof l === 'string' ? l : l?.name || '')).filter(Boolean);
  const labelSet = new Set(labels);
  const lookup = storiesMap instanceof Map ? storiesMap : new Map(Object.entries(storiesMap || {}));
  const storyRefs = extractStoryRefs(`${title}\n${body}`);
  const matchedStories = storyRefs.map((id) => lookup.get(id)).filter(Boolean);

  const base = {
    number: num,
    title,
    url: issue.url || '',
    labels,
    needsVerification: labelSet.has('do-weryfikacji'),
    hasHighPriority: labelSet.has('priorytet:wysoki'),
    hasBug: labelSet.has('bug'),
    storyRefs,
    matchedStories,
  };

  if (labelSet.has('typ:biznes')) {
    return { ...base, category: 'EXCLUDED_BUSINESS', reason: 'Zadanie biznesowe (typ:biznes)' };
  }
  const nonCodeLabel = labels.find((l) => NON_CODE_LABELS.has(l));
  if (nonCodeLabel || NON_CODE_TITLE_RE.test(title)) {
    return { ...base, category: 'EXCLUDED_NON_CODE', reason: nonCodeLabel ? `Etykieta ${nonCodeLabel}` : 'Spike/Legal poza automatycznym kodem' };
  }
  const issueBranchRe = new RegExp(`(^|[-_/])issue-${num}([^0-9]|$)`, 'i');
  const issueMentionRe = new RegExp(`(?<!\\d)#${num}(?!\\d)`);
  const matchingPr = openPrs.find(
    (pr) => issueBranchRe.test(pr.headRefName || '') || issueMentionRe.test(`${pr.title || ''}\n${pr.body || ''}`),
  );
  if (matchingPr) {
    return { ...base, category: 'EXCLUDED_OPEN_PR', reason: `Otwarty PR #${matchingPr.number}` };
  }

  const allBlockedStories =
    matchedStories.length > 0 && matchedStories.every((s) => s.statusEmoji === '❌' || s.statusEmoji === '⏸️' || s.statusEmoji === '🔭');
  if (!contractWindowOpen && (CONTRACT_NEED_RE.test(`${title}\n${body}`) || allBlockedStories)) {
    return { ...base, category: 'NEEDS_CONTRACT', reason: 'Wymaga otwarcia okna kontraktowego przez człowieka' };
  }
  return { ...base, category: 'READY', reason: base.needsVerification ? 'Gotowe (wymaga weryfikacji starego długu)' : 'Gotowe do realizacji' };
}

export function buildQueueReport({ issues = [], openPrs = [], storiesMap = new Map(), contractWindowOpen = false } = {}) {
  const ready = [];
  const needsContract = [];
  const excluded = [];
  for (const issue of issues) {
    const item = classifyIssue(issue, { openPrs, storiesMap, contractWindowOpen });
    if (item.category === 'READY') ready.push(item);
    else if (item.category === 'NEEDS_CONTRACT') needsContract.push(item);
    else excluded.push(item);
  }
  ready.sort(
    (a, b) =>
      Number(a.needsVerification) - Number(b.needsVerification) ||
      Number(b.hasHighPriority) - Number(a.hasHighPriority) ||
      Number(b.hasBug) - Number(a.hasBug) ||
      a.number - b.number,
  );
  return { ready, needsContract, excluded, recommended: ready[0] || null };
}

function tokenizeCommand(cmd) {
  const tokens = [];
  let cur = '';
  let quote = null;
  for (const ch of cmd) {
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (cur) { tokens.push(cur); cur = ''; }
    } else cur += ch;
  }
  if (quote) return null;
  if (cur) tokens.push(cur);
  return tokens;
}

const BAD_SHELL_RE = /&&|\|\||[;|`<>]|\$\(|[\r\n]/;
const FORBIDDEN_PUSH_FLAGS = new Set([
  '-f', '--force', '--force-with-lease', '--force-if-includes',
  '-d', '--delete', '--all', '--tags', '--mirror', '--no-verify', '-n',
]);
const SAFE_VALUE_FLAGS = new Set(['-o', '--push-option', '--repo', '--receive-pack']);
const SAFE_BOOL_FLAGS = new Set(['-u', '--set-upstream', '--porcelain', '-q', '--quiet', '-v', '--verbose', '--progress']);

function resolveTargetBranch(ref, currentBranch) {
  if (!ref) return { branch: currentBranch };
  if (ref.startsWith('+') || ref.startsWith(':')) return { error: `Niedozwolony refspec push: ${ref}` };
  if (ref.includes(':')) {
    const [src, dst, ...extra] = ref.split(':');
    if (extra.length || !dst) return { error: `Niepoprawny refspec: ${ref}` };
    if (src && src !== 'HEAD' && src !== currentBranch) return { error: `Źródłowy ref '${src}' nie pasuje do '${currentBranch}'.` };
    return { branch: dst.replace(/^refs\/heads\//, '') };
  }
  return { branch: ref === 'HEAD' ? currentBranch : ref.replace(/^refs\/heads\//, '') };
}

export function isAutoIssuePushAllowed({ commandLine = '', currentBranch = '', headSha = '', receipt = null, nowMs = Date.now() } = {}) {
  if (!commandLine || BAD_SHELL_RE.test(commandLine)) return { allowed: false, reason: 'Komenda zawiera niedozwolone operatory powłoki.' };
  const tokens = tokenizeCommand(commandLine.trim());
  if (!tokens || tokens.length < 2 || tokens[0].split('/').pop() !== 'git') {
    return { allowed: false, reason: 'Dozwolona wyłącznie pojedyncza komenda git push.' };
  }
  let idx = tokens[1] === '-C' ? 3 : 1;
  if (tokens[1] === '-C' && !tokens[2]) return { allowed: false, reason: 'Brak ścieżki po -C.' };
  if (tokens[idx++] !== 'push') return { allowed: false, reason: 'Dozwolone wyłącznie git push.' };

  const positional = [];
  for (; idx < tokens.length; idx++) {
    const t = tokens[idx];
    if (FORBIDDEN_PUSH_FLAGS.has(t) || t.startsWith('--force') || t.startsWith('--delete')) {
      return { allowed: false, hardDeny: true, reason: `Niedozwolona flaga push: ${t}` };
    }
    if (SAFE_BOOL_FLAGS.has(t) || t.startsWith('--push-option=') || t.startsWith('--repo=')) continue;
    if (SAFE_VALUE_FLAGS.has(t)) { idx += 1; continue; }
    if (t.startsWith('-')) return { allowed: false, reason: `Nieobsługiwana flaga push: ${t}` };
    positional.push(t);
  }
  if (positional.length > 2) return { allowed: false, reason: 'Dozwolony push maksymalnie jednego refspeca.' };
  const remote = positional[0] || 'origin';
  if (remote !== 'origin') return { allowed: false, reason: `Remote musi być origin (otrzymano: ${remote}).` };
  if (!currentBranch || PROTECTED_BRANCHES.has(currentBranch) || !AUTO_BRANCH_RE.test(currentBranch)) {
    return { allowed: false, reason: `Bieżąca gałąź '${currentBranch}' nie jest gałęzią auto/issue-*.` };
  }
  const resolved = resolveTargetBranch(positional[1], currentBranch);
  if (resolved.error) return { allowed: false, reason: resolved.error };
  if (PROTECTED_BRANCHES.has(resolved.branch) || !AUTO_BRANCH_RE.test(resolved.branch) || resolved.branch !== currentBranch) {
    return { allowed: false, reason: `Gałąź docelowa '${resolved.branch}' nie zgadza się z '${currentBranch}'.` };
  }
  if (!receipt || typeof receipt !== 'object') return { allowed: false, reason: 'Brak lokalnego kwitu zatwierdzenia Codexa.' };
  if (receipt.verdict !== 'APPROVED' || receipt.verifyPassed !== true) {
    return { allowed: false, reason: 'Kwit Codexa nie ma statusu APPROVED + verifyPassed.' };
  }
  if (!headSha || receipt.commitSha !== headSha || receipt.branch !== currentBranch) {
    return { allowed: false, reason: 'Kwit Codexa nie odpowiada bieżącemu SHA commita lub gałęzi.' };
  }
  const approvedMs = Date.parse(receipt.approvedAt || '');
  if (!Number.isFinite(approvedMs) || nowMs - approvedMs < 0 || nowMs - approvedMs > RECEIPT_MAX_AGE_MS) {
    return { allowed: false, reason: 'Kwit Codexa wygasł lub ma niepoprawny znacznik czasu.' };
  }
  return { allowed: true };
}

export function validateCodexVerdict(payload, mode) {
  const allowed = ALLOWED_VERDICTS[mode];
  if (!allowed) return { valid: false, error: `Unknown review mode: ${mode}` };
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { valid: false, error: 'Payload must be an object.' };
  if (!allowed.has(payload.verdict)) return { valid: false, error: `Invalid verdict '${payload.verdict}' for ${mode}.` };
  if (typeof payload.summary !== 'string' || !payload.summary.trim()) return { valid: false, error: 'Missing non-empty summary.' };
  if (!Array.isArray(payload.blocking_issues) || payload.blocking_issues.some((x) => typeof x !== 'string')) {
    return { valid: false, error: 'blocking_issues must be an array of strings.' };
  }
  if (typeof payload.contract_impact !== 'boolean') return { valid: false, error: 'contract_impact must be a boolean.' };
  if (!Array.isArray(payload.suggestions) || payload.suggestions.some((x) => typeof x !== 'string')) {
    return { valid: false, error: 'suggestions must be an array of strings.' };
  }
  if (payload.verdict === 'APPROVED' && payload.blocking_issues.length > 0) {
    return { valid: false, error: 'APPROVED verdict cannot contain blocking_issues.' };
  }
  return { valid: true, value: payload };
}
