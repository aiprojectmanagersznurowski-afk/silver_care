import { describe, it, expect } from 'vitest';
import {
  AUTO_BRANCH_RE,
  buildAutoBranchName,
  parseStoriesMarkdown,
  classifyIssue,
  buildQueueReport,
  isAutoIssuePushAllowed,
  validateCodexVerdict,
} from '../../tools/lib/auto-issue-core.mjs';

const SAMPLE_STORIES = `
### [TASK-INFRA-01] Eskalacja Supabase Pro
🔗 **Kontrakt:** \`INFRA-PITR\` · **Status:** ⏸️ DEFERRED
#### [SC-NUR-15] Wydruk planu pracy zmiany
🔗 **Kontrakt:** \`NUR-SHIFT-PRINT\` · **WO:** [\`NUR-SHIFT-PRINT\`](workorders/NUR-SHIFT-PRINT.md) · **Status:** ✅ 📝
#### [SC-ADM-24] Źródło finansowania pobytu
🔗 **Kontrakt:** brak REQ · **Status:** ❌
`;

describe('Autonomous Issue Automation Core (@REQ: INFRA-EU-REGION)', () => {
  it('builds deterministic ASCII branch names matching AUTO_BRANCH_RE', () => {
    const branch = buildAutoBranchName(245, '[SC-ADM-10] Zduplikowane sektory: Łódź / żółć!');
    expect(branch).toMatch(AUTO_BRANCH_RE);
    expect(branch).toBe('auto/issue-245-sc-adm-10-zduplikowane-sektory-lodz-zolc');
    expect(buildAutoBranchName(305, 'A'.repeat(120)).length).toBeLessThanOrEqual(68);
  });

  it('parses ### and #### user stories with contract IDs and status emojis', () => {
    const stories = parseStoriesMarkdown(SAMPLE_STORIES);
    expect(stories.size).toBe(3);
    expect(stories.get('TASK-INFRA-01')).toMatchObject({
      id: 'TASK-INFRA-01',
      reqs: ['INFRA-PITR'],
      statusEmoji: '⏸️',
    });
    expect(stories.get('SC-NUR-15')).toMatchObject({
      id: 'SC-NUR-15',
      reqs: ['NUR-SHIFT-PRINT'],
      statusEmoji: '✅',
    });
    expect(stories.get('SC-ADM-24')).toMatchObject({
      id: 'SC-ADM-24',
      reqs: [],
      statusEmoji: '❌',
    });
  });

  it('classifies and prioritizes technical issues while excluding business, non-code, open PR, and contract-blocked items', () => {
    const storiesMap = parseStoriesMarkdown(SAMPLE_STORIES);
    const issues = [
      { number: 306, title: '[LEGAL-PILOT] Umowa', body: '', labels: [{ name: 'typ:biznes' }] },
      { number: 262, title: '[SPIKE-MDR] Analiza', body: '', labels: [{ name: 'domena:SEC' }] },
      { number: 260, title: 'Pytanie o UX', body: '', labels: [{ name: 'question' }] },
      { number: 305, title: '[NUR-PRINT] SC-NUR-15', body: '', labels: [{ name: 'domena:NUR' }] },
      { number: 246, title: 'SC-ADM-24 Finansowanie', body: '', labels: [{ name: 'domena:ADM' }] },
      { number: 248, title: 'Nowe pole kontraktu', body: 'Wymaga zmiany w contracts/roles.contract.mjs', labels: [] },
      { number: 245, title: 'Sektory zdublowane', body: '', labels: [{ name: 'do-weryfikacji' }, { name: 'priorytet:wysoki' }] },
      { number: 242, title: 'Audyt terminologii', body: 'Dotyczy SC-NUR-15', labels: [{ name: 'bug' }] },
      { number: 241, title: 'Krytyczny bug RLS', body: '', labels: [{ name: 'priorytet:wysoki' }, { name: 'bug' }] },
    ];
    const openPrs = [{ number: 400, title: 'Fix #305', headRefName: 'auto/issue-305-nur-print', body: '' }];

    const report = buildQueueReport({ issues, openPrs, storiesMap, contractWindowOpen: false });

    expect(report.excluded.map((x) => [x.number, x.category])).toEqual([
      [306, 'EXCLUDED_BUSINESS'],
      [262, 'EXCLUDED_NON_CODE'],
      [260, 'EXCLUDED_NON_CODE'],
      [305, 'EXCLUDED_OPEN_PR'],
    ]);
    expect(report.needsContract.map((x) => x.number)).toEqual([246, 248]);
    expect(report.ready.map((x) => x.number)).toEqual([241, 242, 245]);
    expect(report.ready[2].needsVerification).toBe(true);
    expect(report.recommended?.number).toBe(241);

    const openContract = classifyIssue(issues[4], { openPrs, storiesMap, contractWindowOpen: true });
    expect(openContract.category).toBe('READY');
  });

  it('authorizes git push only for verified auto/issue-* branches with fresh matching Codex receipt', () => {
    const nowMs = Date.parse('2026-11-21T10:00:00Z');
    const receipt = {
      commitSha: 'abc1234',
      branch: 'auto/issue-245-dup-sectors',
      verdict: 'APPROVED',
      verifyPassed: true,
      approvedAt: '2026-11-21T09:30:00Z',
    };

    expect(
      isAutoIssuePushAllowed({
        commandLine: 'git push -u origin auto/issue-245-dup-sectors',
        currentBranch: 'auto/issue-245-dup-sectors',
        headSha: 'abc1234',
        receipt,
        nowMs,
      }).allowed,
    ).toBe(true);

    expect(
      isAutoIssuePushAllowed({
        commandLine: 'git -C /tmp/wt push origin HEAD:auto/issue-245-dup-sectors',
        currentBranch: 'auto/issue-245-dup-sectors',
        headSha: 'abc1234',
        receipt,
        nowMs,
      }).allowed,
    ).toBe(true);

    const rejected = [
      ['git push origin staging', 'auto/issue-245-dup-sectors', 'abc1234', receipt],
      ['git push origin main', 'main', 'abc1234', receipt],
      ['git push origin feat/other', 'feat/other', 'abc1234', receipt],
      ['git push --force origin auto/issue-245-dup-sectors', 'auto/issue-245-dup-sectors', 'abc1234', receipt],
      ['git push -f origin auto/issue-245-dup-sectors', 'auto/issue-245-dup-sectors', 'abc1234', receipt],
      ['git push origin --delete auto/issue-245-dup-sectors', 'auto/issue-245-dup-sectors', 'abc1234', receipt],
      ['git push origin :auto/issue-245-dup-sectors', 'auto/issue-245-dup-sectors', 'abc1234', receipt],
      ['git push origin auto/issue-245-dup-sectors && rm -rf /tmp/x', 'auto/issue-245-dup-sectors', 'abc1234', receipt],
      ['git push origin auto/issue-245-dup-sectors', 'auto/issue-245-dup-sectors', 'deadbeef', receipt],
      ['git push origin auto/issue-245-dup-sectors', 'auto/issue-245-dup-sectors', 'abc1234', null],
      ['git push origin auto/issue-245-dup-sectors', 'auto/issue-245-dup-sectors', 'abc1234', { ...receipt, verifyPassed: false }],
      ['git push origin auto/issue-245-dup-sectors', 'auto/issue-245-dup-sectors', 'abc1234', { ...receipt, approvedAt: '2026-11-21T06:00:00Z' }],
    ] as const;

    for (const [cmd, branch, sha, rec] of rejected) {
      const res = isAutoIssuePushAllowed({ commandLine: cmd, currentBranch: branch, headSha: sha, receipt: rec, nowMs });
      expect(res.allowed, `expected reject for: ${cmd}`).toBe(false);
    }
  });

  it('validates structured Codex verdicts for plan-review and code-review', () => {
    expect(
      validateCodexVerdict(
        { verdict: 'APPROVED', summary: 'Plan i testy zgodne.', blocking_issues: [], contract_impact: false, suggestions: [] },
        'plan-review',
      ).valid,
    ).toBe(true);
    expect(
      validateCodexVerdict(
        { verdict: 'CHANGES_REQUESTED', summary: 'Brak testu RLS.', blocking_issues: ['Dodaj test'], contract_impact: false, suggestions: [] },
        'code-review',
      ).valid,
    ).toBe(true);
    expect(
      validateCodexVerdict(
        { verdict: 'CHANGES_REQUESTED', summary: 'Zły tryb.', blocking_issues: ['x'], contract_impact: false, suggestions: [] },
        'plan-review',
      ).valid,
    ).toBe(false);
    expect(
      validateCodexVerdict(
        { verdict: 'APPROVED', summary: '', blocking_issues: ['Niepuste'], contract_impact: false, suggestions: [] },
        'code-review',
      ).valid,
    ).toBe(false);
  });
});
