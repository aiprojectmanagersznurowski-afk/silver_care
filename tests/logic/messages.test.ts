import { describe, it, expect } from 'vitest';
import { isSpamLimitExceeded } from '../../apps/web/src/lib/messages';

describe('Messages Logic (FAM-MESSAGES)', () => {
  it('identifies when spam limit is exceeded @REQ: FAM-MESSAGES', () => {
    expect(isSpamLimitExceeded(0)).toBe(false);
    expect(isSpamLimitExceeded(1)).toBe(false);
    expect(isSpamLimitExceeded(2)).toBe(false);
    expect(isSpamLimitExceeded(3)).toBe(true);
    expect(isSpamLimitExceeded(10)).toBe(true);
  });
});
