#!/usr/bin/env node
/**
 * sc-pr-handoff — przekazanie zadania do review (INFRA-SDLC-WORKFLOW) na GitHubie.
 *
 * Od 2026-11-17 zadania są w GitHub Issues i na tablicy GitHub Projects „Silver Care”
 * (decyzja Michała i Darka); Trello zostaje tylko do odczytu.
 *
 * UŻYCIE:
 *   node tools/sc-pr-handoff.mjs <NUMER_ISSUE> [opcje]
 *
 * OPCJE:
 *   --to darek|michal      Wymuszenie recenzenta
 *   --pr <numer>           PR do przekazania: recenzent na PR i „Closes #<issue>” w opisie
 *   --skip-verify          Pominięcie verify.sh (jeśli wykonano wcześniej)
 *   --notes <tekst>        Notatka dla recenzenta w komentarzu
 *   --dry-run              Tylko pokaż planowane akcje
 *
 * Wymaga zalogowanego `gh` z uprawnieniami repo i project (`gh auth status`).
 */

import { execFileSync, execSync } from 'node:child_process';
import { BOARD, determineReviewer, determineAuthor, formatHandoffComment, ensureClosesKeyword } from './lib/sdlc-handoff-core.mjs';

const args = process.argv.slice(2);
if (args.length === 0 || !/^\d+$/.test(args[0])) {
  console.log(`
Użycie:
  node tools/sc-pr-handoff.mjs <NUMER_ISSUE> [--pr <numer>] [--to darek|michal] [--skip-verify] [--notes "..."] [--dry-run]

Przykład:
  node tools/sc-pr-handoff.mjs 231 --pr 232
`);
  process.exit(1);
}

const issue = args[0];
const dryRun = args.includes('--dry-run');
const skipVerify = args.includes('--skip-verify');
const arg = (flag) => {
  const i = args.indexOf(flag);
  return i !== -1 && i + 1 < args.length ? args[i + 1] : null;
};
const forcedTo = arg('--to');
const pr = arg('--pr');
const notes = arg('--notes');

const gh = (...a) => execFileSync('gh', a, { encoding: 'utf8' }).trim();
const ghJson = (...a) => JSON.parse(gh(...a));

function setInReviewStatus(issueUrl) {
  const project = ghJson('project', 'view', String(BOARD.projectNumber), '--owner', BOARD.owner, '--format', 'json');
  const field = ghJson('project', 'field-list', String(BOARD.projectNumber), '--owner', BOARD.owner, '--format', 'json')
    .fields.find((f) => f.name === BOARD.statusField);
  const option = field?.options?.find((o) => o.name === BOARD.inReview);
  if (!field || !option) throw new Error(`Brak pola „${BOARD.statusField}” albo opcji „${BOARD.inReview}” na tablicy`);
  // item-add jest idempotentne: zwraca istniejący element, jeśli issue już jest na tablicy
  const item = ghJson('project', 'item-add', String(BOARD.projectNumber), '--owner', BOARD.owner, '--url', issueUrl, '--format', 'json');
  gh('project', 'item-edit', '--id', item.id, '--project-id', project.id, '--field-id', field.id, '--single-select-option-id', option.id);
}

function run() {
  console.log('🔄 === SILVER CARE SDLC HAND-OFF (INFRA-SDLC-WORKFLOW) ===\n');

  if (!skipVerify) {
    console.log('▸ Krok 1/4: bash scripts/verify.sh --full');
    try {
      execSync('bash scripts/verify.sh --full', { stdio: 'inherit' });
    } catch {
      console.error('\n❌ Bramka czerwona — nie przekazuję do review.');
      process.exit(1);
    }
  } else {
    console.log('▸ Krok 1/4: weryfikacja pominięta (--skip-verify).');
  }

  console.log(`\n▸ Krok 2/4: issue #${issue}`);
  const data = ghJson('issue', 'view', issue, '--repo', BOARD.repo, '--json', 'title,url,assignees,state');
  if (data.state !== 'OPEN') {
    console.error(`❌ Issue #${issue} nie jest otwarte (${data.state}).`);
    process.exit(1);
  }
  const assignees = data.assignees.map((a) => a.login);
  // Nieprzypisane issue: autorem jest zalogowany użytkownik gh, recenzentem druga osoba
  const authorHint = assignees.length ? assignees : [gh('api', 'user', '--jq', '.login')];
  const reviewer = determineReviewer(authorHint, forcedTo);
  const author = determineAuthor(reviewer);
  console.log(`  ✓ ${data.title}`);
  console.log(`  - autor: @${author.github}, recenzent: @${reviewer.github}`);

  let commits = [];
  try {
    commits = execSync('git log -n 5 --oneline', { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch {
    // brak repozytorium lub commitów
  }
  const prUrl = pr ? `https://github.com/${BOARD.repo}/pull/${pr}` : null;
  const comment = formatHandoffComment({ author, reviewer, commits, verifyPassed: !skipVerify, prUrl, notes });

  if (dryRun) {
    console.log('\n[DRY-RUN] Komentarz:\n\n' + comment + '\n\n[DRY-RUN] Bez zmian.');
    return;
  }

  console.log('\n▸ Krok 3/4: issue — recenzent, status, komentarz');
  const toRemove = assignees.filter((a) => a !== reviewer.github);
  gh('issue', 'edit', issue, '--repo', BOARD.repo, '--add-assignee', reviewer.github, ...(toRemove.length ? ['--remove-assignee', toRemove.join(',')] : []));
  setInReviewStatus(data.url);
  gh('issue', 'comment', issue, '--repo', BOARD.repo, '--body', comment);
  console.log(`  ✓ przypisane do @${reviewer.github}, status „${BOARD.inReview}”, komentarz dodany`);

  if (pr) {
    console.log(`\n▸ Krok 4/4: PR #${pr} — recenzent i „Closes #${issue}”`);
    const body = ghJson('pr', 'view', pr, '--repo', BOARD.repo, '--json', 'body').body || '';
    gh('pr', 'edit', pr, '--repo', BOARD.repo, '--add-reviewer', reviewer.github, '--body', ensureClosesKeyword(body, issue));
    console.log('  ✓ gotowe');
  } else {
    console.log(`\n▸ Krok 4/4: pominięty (bez --pr). Pamiętaj: recenzent @${reviewer.github} na PR i „Closes #${issue}” w opisie.`);
  }

  console.log(`\n🎉 Przekazano. NIE scalaj sam — scala @${reviewer.github} po review.`);
}

run();
