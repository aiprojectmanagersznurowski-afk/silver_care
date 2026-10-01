import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * @REQ: UI-ACCESSIBILITY
 * @REQ: UI-FOUR-STATES
 * Weryfikacja eliminacji window.alert i window.confirm na rzecz nowoczesnego feedbacku (Toast, ConfirmDialog, Tooltip).
 */
describe('UI Feedback & Tooltips (@REQ: UI-ACCESSIBILITY, @REQ: UI-FOUR-STATES)', () => {
  const webSrcDir = path.resolve(__dirname, '../../apps/web/src');

  function scanFiles(dir: string, extensions: string[]): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        results = results.concat(scanFiles(filePath, extensions));
      } else if (extensions.some((ext) => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
    return results;
  }

  it('eliminates all window.alert and alert() calls in apps/web/src @REQ: UI-ACCESSIBILITY', () => {
    const files = scanFiles(webSrcDir, ['.ts', '.tsx']);
    const alertRegex = /\b(window\.)?alert\s*\(/;

    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (alertRegex.test(line)) {
          violations.push({ file: path.relative(webSrcDir, file), line: index + 1, text: line.trim() });
        }
      });
    }

    expect(violations).toHaveLength(0);
  });

  it('eliminates all window.confirm and confirm() calls in apps/web/src @REQ: UI-ACCESSIBILITY', () => {
    const files = scanFiles(webSrcDir, ['.ts', '.tsx']);
    const confirmRegex = /\b(window\.)?confirm\s*\(/;

    const violations: { file: string; line: number; text: string }[] = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) return;
        if (confirmRegex.test(line)) {
          violations.push({ file: path.relative(webSrcDir, file), line: index + 1, text: line.trim() });
        }
      });
    }

    expect(violations).toHaveLength(0);
  });

  it('provides accessible sonner toaster and confirm-dialog components @REQ: UI-FOUR-STATES', () => {
    const sonnerPath = path.join(webSrcDir, 'components/ui/sonner.tsx');
    const confirmDialogPath = path.join(webSrcDir, 'components/ui/confirm-dialog.tsx');
    const tooltipPath = path.join(webSrcDir, 'components/ui/tooltip.tsx');

    expect(fs.existsSync(sonnerPath)).toBe(true);
    expect(fs.existsSync(confirmDialogPath)).toBe(true);
    expect(fs.existsSync(tooltipPath)).toBe(true);

    const sonnerContent = fs.readFileSync(sonnerPath, 'utf-8');
    expect(sonnerContent).toContain('Toaster');
    expect(sonnerContent).toContain('toast');

    const confirmContent = fs.readFileSync(confirmDialogPath, 'utf-8');
    expect(confirmContent).toContain('ConfirmDialog');
  });
});
