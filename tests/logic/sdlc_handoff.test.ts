import { describe, it, expect } from 'vitest';
import {
  BOARD,
  MEMBERS,
  determineReviewer,
  determineAuthor,
  formatHandoffComment,
  ensureClosesKeyword
} from '../../tools/lib/sdlc-handoff-core.mjs';

/**
 * Przekazanie do review (INFRA-SDLC-WORKFLOW) na GitHubie: issue w GitHub Projects „Silver Care”
 * zamiast karty Trello (decyzja Michała i Darka 2026-11-17).
 */
describe('SDLC Handoff Workflow Logic (@REQ: INFRA-EU-REGION)', () => {
  it('wskazuje tablicę GitHub Projects i status „PR Created / In Review”', () => {
    expect(BOARD).toEqual({ owner: 'aiprojectmanagersznurowski-afk', repo: 'aiprojectmanagersznurowski-afk/silver_care', projectNumber: 1, statusField: 'Status', inReview: 'PR Created / In Review' });
  });

  it('recenzentem jest Michał, gdy issue jest przypisane do Darka (login GitHub)', () => {
    const reviewer = determineReviewer([MEMBERS.DAREK.github]);
    expect(reviewer.github).toBe(MEMBERS.MICHAL.github);
    expect(determineAuthor(reviewer).github).toBe(MEMBERS.DAREK.github);
  });

  it('recenzentem jest Darek, gdy issue jest przypisane do Michała (login GitHub)', () => {
    const reviewer = determineReviewer([MEMBERS.MICHAL.github]);
    expect(reviewer.github).toBe(MEMBERS.DAREK.github);
    expect(determineAuthor(reviewer).github).toBe(MEMBERS.MICHAL.github);
  });

  it('flaga --to wygrywa z bieżącym przypisaniem', () => {
    expect(determineReviewer([MEMBERS.MICHAL.github], 'michal').github).toBe(MEMBERS.MICHAL.github);
    expect(determineReviewer([MEMBERS.DAREK.github], 'darek').github).toBe(MEMBERS.DAREK.github);
    expect(determineReviewer([], 'darkov89').github).toBe(MEMBERS.DAREK.github);
  });

  it('komentarz przekazania z loginami GitHub i zasadą „autor nie scala”', () => {
    const comment = formatHandoffComment({
      author: MEMBERS.DAREK,
      reviewer: MEMBERS.MICHAL,
      commits: ['feat(infra): implement SDLC workflow tool'],
      verifyPassed: true,
      prUrl: 'https://github.com/silvercare/repo/pull/101'
    });
    expect(comment).toContain('Zadanie ukończone — zgłoszenie do Code Review');
    expect(comment).toContain('Darek Rink (@darkov89)');
    expect(comment).toContain('Michał Sznurowski (@aiprojectmanagersznurowski-afk)');
    expect(comment).toContain('https://github.com/silvercare/repo/pull/101');
    expect(comment).toContain('Autor nie scala własnego PR');
    expect(comment).toContain('INFRA-SDLC-WORKFLOW');
    expect(comment).not.toMatch(/Trello/);
  });

  it('dopisuje „Closes #N” do opisu PR tylko raz', () => {
    const once = ensureClosesKeyword('Opis zmiany', 42);
    expect(once).toBe('Opis zmiany\n\nCloses #42');
    expect(ensureClosesKeyword(once, 42)).toBe(once);
    expect(ensureClosesKeyword('Naprawia błąd. Fixes #42', 42)).toBe('Naprawia błąd. Fixes #42');
    expect(ensureClosesKeyword('', 7)).toBe('Closes #7');
  });
});
