import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * @REQ: UI-ACCESSIBILITY
 * @REQ: FAM-MESSAGES
 *
 * Domknięcie uwagi z review PR #47 (FIX-REVIEW-DEBT-PR44-PR47, AC4):
 * <button> wewnątrz <Link> to nieprawidłowy HTML (interaktywny element w <a>),
 * ostrzeżenie validateDOMNesting i dwa elementy fokusowalne dla jednej akcji.
 */
describe('Brak <button> zagnieżdżonego w <Link> (@REQ: UI-ACCESSIBILITY)', () => {
  const webSrcDir = path.resolve(__dirname, '../../apps/web/src');

  function scanFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) return scanFiles(p);
      return entry.name.endsWith('.tsx') ? [p] : [];
    });
  }

  it('żaden <Link> w apps/web/src nie zawiera bezpośrednio <button> @REQ: UI-ACCESSIBILITY', () => {
    const nested = /<Link\b[^>]*>\s*<button\b/g;
    const violations: string[] = [];

    for (const file of scanFiles(webSrcDir)) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const match of content.matchAll(nested)) {
        const line = content.slice(0, match.index).split('\n').length;
        violations.push(`${path.relative(webSrcDir, file)}:${line}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it('akcja „Wiadomości od rodziny" na tablicy personelu jest linkiem do wątku pensjonariusza @REQ: FAM-MESSAGES', () => {
    const src = fs.readFileSync(path.join(webSrcDir, 'components/StaffBoardClient.tsx'), 'utf-8');
    const link = src.match(/<Link\b[^>]*href=\{`\/staff\/messages\?residentId=\$\{resident\.id\}`\}[^>]*>([\s\S]*?)<\/Link>/);

    expect(link).not.toBeNull();
    expect(link![0]).toMatch(/min-h-\[44px\]/);
    expect(link![1]).toContain('Wiadomości od rodziny');
    expect(link![1]).not.toMatch(/<button\b/);
  });
});
