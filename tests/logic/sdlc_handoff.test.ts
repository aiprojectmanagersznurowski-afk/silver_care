import { describe, it, expect } from 'vitest';
import {
  IN_REVIEW_LIST_ID,
  MEMBERS,
  determineReviewer,
  determineAuthor,
  formatHandoffComment
} from '../../tools/lib/sdlc-handoff-core.mjs';

describe('SDLC Handoff Workflow Logic (@REQ: INFRA-EU-REGION)', () => {
  it('defines correct PR Created / In Review Trello list ID', () => {
    expect(IN_REVIEW_LIST_ID).toBe('6aa420f641a1300e6a97a10f');
  });

  it('determines Michał as reviewer when card is assigned to Darek', () => {
    const reviewer = determineReviewer([MEMBERS.DAREK.id]);
    expect(reviewer.id).toBe(MEMBERS.MICHAL.id);
    expect(reviewer.name).toBe('Michał Sznurowski');

    const author = determineAuthor(reviewer);
    expect(author.id).toBe(MEMBERS.DAREK.id);
  });

  it('determines Darek as reviewer when card is assigned to Michał', () => {
    const reviewer = determineReviewer([MEMBERS.MICHAL.id]);
    expect(reviewer.id).toBe(MEMBERS.DAREK.id);
    expect(reviewer.name).toBe('Darek Rink');

    const author = determineAuthor(reviewer);
    expect(author.id).toBe(MEMBERS.MICHAL.id);
  });

  it('respects forced reviewer flag regardless of current assignees', () => {
    const forcedMichal = determineReviewer([MEMBERS.MICHAL.id], 'michal');
    expect(forcedMichal.id).toBe(MEMBERS.MICHAL.id);

    const forcedDarek = determineReviewer([MEMBERS.DAREK.id], 'darek');
    expect(forcedDarek.id).toBe(MEMBERS.DAREK.id);
  });

  it('formats audit handoff comment with required SDLC policy notice', () => {
    const comment = formatHandoffComment({
      author: MEMBERS.DAREK,
      reviewer: MEMBERS.MICHAL,
      commits: ['feat(infra): implement SDLC workflow tool', 'test(logic): add handoff tests'],
      verifyPassed: true,
      prUrl: 'https://github.com/silvercare/repo/pull/101'
    });

    expect(comment).toContain('Zadanie ukończone — zgłoszenie do Code Review');
    expect(comment).toContain('Darek Rink (@darekrink)');
    expect(comment).toContain('Michał Sznurowski (@michalsznurowski)');
    expect(comment).toContain('100% PASS');
    expect(comment).toContain('https://github.com/silvercare/repo/pull/101');
    expect(comment).toContain('Autor nie merguje własnego kodu do `main`');
    expect(comment).toContain('INFRA-SDLC-WORKFLOW');
  });
});
