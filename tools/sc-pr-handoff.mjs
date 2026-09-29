#!/usr/bin/env node
/**
 * sc-pr-handoff — Automatyzacja procedury SDLC Hand-off (INFRA-SDLC-WORKFLOW)
 *
 * UŻYCIE:
 *   node tools/sc-pr-handoff.mjs <CARD_ID_LUB_REQ_ID> [opcje]
 *
 * OPCJE:
 *   --to darek|michal      Wymuszenie przypisania konkretnego recenzenta
 *   --pr-url <url>         Link do otwartego Pull Requesta
 *   --skip-verify          Pominięcie ponownego uruchamiania verify.sh (jeśli wykonano wcześniej)
 *   --notes <tekst>        Dodatkowa notatka dla recenzenta w komentarzu
 *   --dry-run              Tylko wyświetl planowane akcje bez modyfikacji Trello
 */

import dotenv from 'dotenv';
import { execSync } from 'node:child_process';
import { IN_REVIEW_LIST_ID, MEMBERS, determineReviewer, determineAuthor, formatHandoffComment } from './lib/sdlc-handoff-core.mjs';

dotenv.config({ path: '.env.local' });

const apiKey = process.env.TRELLO_API;
const token = process.env.TRELLO_TOKEN;

if (!apiKey || !token) {
  console.error('❌ Błąd: Brak TRELLO_API lub TRELLO_TOKEN w .env.local');
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0 || args[0].startsWith('-')) {
  console.log(`
Użycie:
  node tools/sc-pr-handoff.mjs <CARD_ID_LUB_REQ_ID> [opcje]

Przykłady:
  node tools/sc-pr-handoff.mjs 6ab51176eff957370b0b46d2
  node tools/sc-pr-handoff.mjs INFRA-SDLC-WORKFLOW --to michal --pr-url https://github.com/.../pull/42
  node tools/sc-pr-handoff.mjs FAM-DASHBOARD --skip-verify
`);
  process.exit(1);
}

const cardTarget = args[0];
const dryRun = args.includes('--dry-run');
const skipVerify = args.includes('--skip-verify');

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
}

const forcedTo = getArgValue('--to');
const prUrl = getArgValue('--pr-url');
const notes = getArgValue('--notes');

async function run() {
  console.log('🔄 === SILVER CARE SDLC HAND-OFF (INFRA-SDLC-WORKFLOW) ===\n');

  // 1. Weryfikacja jakościowa
  if (!skipVerify) {
    console.log('▸ Krok 1/4: Uruchamianie pełnej bramki jakościowej (bash scripts/verify.sh --full)...');
    try {
      execSync('bash scripts/verify.sh --full', { stdio: 'inherit' });
      console.log('  ✓ Bramka jakościowa przeszła pomyślnie (100% PASS).\n');
    } catch (err) {
      console.error('\n❌ BŁĄD BRAMKI: Nie można przekazać zadania do review, dopóki verify.sh --full nie przechodzi w 100%!');
      process.exit(1);
    }
  } else {
    console.log('▸ Krok 1/4: Weryfikacja jakościowa pominięta na żądanie flagi --skip-verify.\n');
  }

  // 2. Pobranie karty z Trello
  console.log(`▸ Krok 2/4: Wyszukiwanie karty '${cardTarget}' na Trello...`);
  let card = null;

  // Próba odczytu bezpośrednio jako cardId (24 znaki hex)
  if (/^[0-9a-fA-F]{24}$/.test(cardTarget)) {
    const res = await fetch(`https://api.trello.com/1/cards/${cardTarget}?key=${apiKey}&token=${token}`);
    if (res.ok) {
      card = await res.json();
    }
  }

  // Jeśli nie ID lub 404, przeszukaj tablicę Silver Care — Backlog
  if (!card) {
    const boardId = '6aa2a30828269c1448177426';
    const boardCardsRes = await fetch(`https://api.trello.com/1/boards/${boardId}/cards?key=${apiKey}&token=${token}`);
    if (boardCardsRes.ok) {
      const allCards = await boardCardsRes.json();
      const match = allCards.find(c => 
        c.name.toLowerCase().includes(cardTarget.toLowerCase()) || 
        c.desc.includes(cardTarget)
      );
      if (match) {
        card = match;
      }
    }
  }

  if (!card) {
    console.error(`❌ Błąd: Nie znaleziono karty Trello odpowiadającej '${cardTarget}'.`);
    process.exit(1);
  }

  console.log(`  ✓ Znaleziono kartę: ${card.name} (ID: ${card.id})`);

  // 3. Wyznaczenie recenzenta i przygotowanie komentarza
  console.log('\n▸ Krok 3/4: Wyznaczanie recenzenta i pobieranie historii git...');
  const reviewer = determineReviewer(card.idMembers, forcedTo);
  const author = determineAuthor(reviewer);

  let recentCommits = [];
  try {
    const gitLog = execSync('git log -n 5 --oneline', { encoding: 'utf8' }).trim();
    if (gitLog) {
      recentCommits = gitLog.split('\n');
    }
  } catch (err) {
    // brak repozytorium lub commitów
  }

  const commentText = formatHandoffComment({
    author,
    reviewer,
    commits: recentCommits,
    verifyPassed: true,
    prUrl,
    notes
  });

  console.log(`  - Autor: ${author.name} (@${author.username})`);
  console.log(`  - Wyznaczony recenzent: ${reviewer.name} (@${reviewer.username})`);
  console.log(`  - Lista docelowa: PR Created / In Review (${IN_REVIEW_LIST_ID})`);

  if (dryRun) {
    console.log('\n[DRY-RUN] Treść komentarza do dodania:\n');
    console.log(commentText);
    console.log('\n[DRY-RUN] Zakończono bez wprowadzania zmian.');
    return;
  }

  // 4. Aktualizacja Trello (przeniesienie, przypisanie, komentarz)
  console.log('\n▸ Krok 4/4: Aktualizacja karty na Trello...');

  // A. Przeniesienie i przypisanie recenzenta
  const moveUrl = `https://api.trello.com/1/cards/${card.id}?idList=${IN_REVIEW_LIST_ID}&idMembers=${reviewer.id}&key=${apiKey}&token=${token}`;
  const moveRes = await fetch(moveUrl, { method: 'PUT' });
  if (!moveRes.ok) {
    console.error('  ✗ Błąd przenoszenia karty:', await moveRes.text());
    process.exit(1);
  }
  console.log(`  ✓ Przeniesiono kartę do listy 'PR Created / In Review'`);
  console.log(`  ✓ Przypisano kartę do: ${reviewer.name} (@${reviewer.username})`);

  // B. Dodanie komentarza
  const commentUrl = `https://api.trello.com/1/cards/${card.id}/actions/comments?key=${apiKey}&token=${token}`;
  const commentRes = await fetch(commentUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: commentText })
  });
  if (!commentRes.ok) {
    console.warn('  ⚠️ Ostrzeżenie: Nie udało się dodać komentarza:', await commentRes.text());
  } else {
    console.log('  ✓ Opublikowano komentarz ze statusem wdrożenia i instrukcją review');
  }

  console.log('\n🎉 === SDLC HAND-OFF ZAKOŃCZONY SUKCESEM ===');
  console.log(`📌 Karta: ${card.name}`);
  console.log(`👤 Reviewer: ${reviewer.name} (@${reviewer.github})`);
  console.log(`⚠️  PAMIĘTAJ O ZASADZIE INFRA-SDLC-WORKFLOW:`);
  console.log(`   - Wystaw lub zaktualizuj Pull Request na GitHubie i przypisz go do @${reviewer.github}.`);
  console.log(`   - NIE MERGUJ SAMEMU! Merge wykonuje wyłącznie ${reviewer.name} po zatwierdzeniu review.`);
}

run().catch(console.error);
