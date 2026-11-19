/**
 * Core logic for SDLC PR handoff between Darek and Michał
 * Rule: INFRA-SDLC-WORKFLOW
 *
 * Od 2026-11-17 zadania żyją w GitHub Issues i tablicy GitHub Projects „Silver Care”
 * (decyzja Michała i Darka), a nie w Trello.
 */

export const BOARD = {
  owner: 'aiprojectmanagersznurowski-afk',
  repo: 'aiprojectmanagersznurowski-afk/silver_care',
  projectNumber: 1,
  statusField: 'Status',
  inReview: 'PR Created / In Review',
};

export const MEMBERS = {
  DAREK: {
    name: 'Darek Rink',
    github: 'darkov89',
  },
  MICHAL: {
    name: 'Michał Sznurowski',
    github: 'aiprojectmanagersznurowski-afk',
  },
};

const isDarek = (v) => ['darek', MEMBERS.DAREK.github].includes(v);
const isMichal = (v) => ['michal', 'michał', MEMBERS.MICHAL.github].includes(v);

/**
 * Wyznacza recenzenta: druga osoba niż obecnie przypisana do issue (loginy GitHub),
 * chyba że wskazano ją flagą --to.
 */
export function determineReviewer(currentAssignees = [], forcedTarget = null) {
  if (forcedTarget) {
    const norm = forcedTarget.toLowerCase();
    if (isDarek(norm)) return MEMBERS.DAREK;
    if (isMichal(norm)) return MEMBERS.MICHAL;
  }

  const hasDarek = currentAssignees.includes(MEMBERS.DAREK.github);
  const hasMichal = currentAssignees.includes(MEMBERS.MICHAL.github);

  if (hasDarek && !hasMichal) return MEMBERS.MICHAL;
  if (hasMichal && !hasDarek) return MEMBERS.DAREK;

  // W przypadku obu lub żadnego, domyślnym recenzentem dla Darka jest Michał
  return MEMBERS.MICHAL;
}

/**
 * Wyznacza autora (drugą osobę niż recenzent)
 */
export function determineAuthor(reviewer) {
  return reviewer.github === MEMBERS.DAREK.github ? MEMBERS.MICHAL : MEMBERS.DAREK;
}

/**
 * Dopisuje „Closes #N” do opisu PR, żeby scalenie zamknęło issue. Nie dubluje słowa kluczowego.
 */
export function ensureClosesKeyword(body = '', issueNumber) {
  const already = new RegExp(`\\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\\s+#${issueNumber}\\b`, 'i');
  if (already.test(body)) return body;
  return body.trim() ? `${body.trimEnd()}\n\nCloses #${issueNumber}` : `Closes #${issueNumber}`;
}

/**
 * Formatuje komentarz przekazania na issue
 */
export function formatHandoffComment({ author, reviewer, commits = [], verifyPassed = true, prUrl = null, notes = null }) {
  const commitLines = commits.length > 0
    ? commits.map(c => `  - \`${c}\``).join('\n')
    : '  - (Brak nowych commitów na gałęzi)';

  const lines = [
    '🚀 **Zadanie ukończone — zgłoszenie do Code Review (SDLC Hand-off)**',
    '',
    `- **Autor wdrożenia:** ${author.name} (@${author.github})`,
    `- **Przypisany recenzent:** ${reviewer.name} (@${reviewer.github})`,
    `- **Bramka Jakościowa:** \`bash scripts/verify.sh --full\` — ${verifyPassed ? '**zielona**' : '⚠️ WYMAGA WERYFIKACJI'}`,
    prUrl ? `- **Pull Request:** ${prUrl}` : `- **Pull Request:** do otwarcia i przypisania recenzenta @${reviewer.github}`,
    '',
    '**Ostatnie commity na gałęzi:**',
    commitLines,
    '',
    notes ? `**Uwagi od autora:**\n${notes}\n` : '',
    '🔒 **Zasada INFRA-SDLC-WORKFLOW:**',
    `Autor nie scala własnego PR. Issue czeka na review i zatwierdzenie przez **${reviewer.name}**; po akceptacji recenzent scala PR, a „Closes #…” zamyka issue i przenosi je do „Done”.`,
  ];

  return lines.join('\n');
}
