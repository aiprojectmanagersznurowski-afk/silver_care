/**
 * Core logic for SDLC PR handoff between Darek and Michał
 * Rule: INFRA-SDLC-WORKFLOW
 */

export const IN_REVIEW_LIST_ID = '6aa420f641a1300e6a97a10f';

export const MEMBERS = {
  DAREK: {
    id: '5ce666443ecfaa7f62756e43',
    name: 'Darek Rink',
    username: 'darekrink',
    github: 'darekrink'
  },
  MICHAL: {
    id: '6a1e8bee5edd0ea47730152c',
    name: 'Michał Sznurowski',
    username: 'michalsznurowski',
    github: 'michalsznurowski'
  }
};

/**
 * Wyznacza recenzenta zadania na podstawie obecnego przypisania i opcjonalnego wskazania
 */
export function determineReviewer(currentMemberIds = [], forcedTarget = null) {
  if (forcedTarget) {
    const norm = forcedTarget.toLowerCase();
    if (norm === 'darek' || norm === MEMBERS.DAREK.id || norm === MEMBERS.DAREK.username) {
      return MEMBERS.DAREK;
    }
    if (norm === 'michal' || norm === 'michał' || norm === MEMBERS.MICHAL.id || norm === MEMBERS.MICHAL.username) {
      return MEMBERS.MICHAL;
    }
  }

  const hasDarek = currentMemberIds.includes(MEMBERS.DAREK.id);
  const hasMichal = currentMemberIds.includes(MEMBERS.MICHAL.id);

  if (hasDarek && !hasMichal) {
    return MEMBERS.MICHAL;
  }
  if (hasMichal && !hasDarek) {
    return MEMBERS.DAREK;
  }

  // W przypadku obu lub żadnego, domyślnym recenzentem dla Darka jest Michał
  return MEMBERS.MICHAL;
}

/**
 * Wyznacza autora (drugą osobę niż recenzent)
 */
export function determineAuthor(reviewer) {
  return reviewer.id === MEMBERS.DAREK.id ? MEMBERS.MICHAL : MEMBERS.DAREK;
}

/**
 * Formatuje komentarz audytowy na Trello
 */
export function formatHandoffComment({ author, reviewer, commits = [], verifyPassed = true, prUrl = null, notes = null }) {
  const commitLines = commits.length > 0
    ? commits.map(c => `  - \`${c}\``).join('\n')
    : '  - (Brak nowych commitów na gałęzi)';

  const lines = [
    '🚀 **Zadanie ukończone — zgłoszenie do Code Review (SDLC Hand-off)**',
    '',
    `- **Autor wdrożenia:** ${author.name} (@${author.username})`,
    `- **Przypisany recenzent:** ${reviewer.name} (@${reviewer.username})`,
    `- **Bramka Jakościowa:** \`bash scripts/verify.sh --full\` — ${verifyPassed ? '**100% PASS (6/6 etapów)**' : '⚠️ WYMAGA WERYFIKACJI'}`,
    prUrl ? `- **Pull Request:** [${prUrl}](${prUrl})` : '- **Pull Request:** Do otwarcia / przypisania na GitHubie do @' + reviewer.github,
    '',
    '**Ostatnie commity na gałęzi:**',
    commitLines,
    '',
    notes ? `**Uwagi od autora:**\n${notes}\n` : '',
    '🔒 **Zasada INFRA-SDLC-WORKFLOW:**',
    `Autor nie merguje własnego kodu do \`main\`. Karta oczekuje na weryfikację i zatwierdzenie przez **${reviewer.name}**. Dopiero po akceptacji recenzent wykonuje merge i zamyka zadanie do kolumny 'Done'.`
  ].filter(line => line !== null);

  return lines.join('\n');
}
