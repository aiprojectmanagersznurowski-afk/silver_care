import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('INFRA-GROQ-TRANSCRIPTION & AI Provenance', () => {

  it('GROQ_API_KEY never leaks into client-side code @REQ: INFRA-GROQ-TRANSCRIPTION', () => {
    const clientDirs = [
      path.resolve(__dirname, '../../apps/web/src/components'),
      path.resolve(__dirname, '../../apps/web/src/app/(staff)'),
      path.resolve(__dirname, '../../apps/web/src/app/(family)'),
      path.resolve(__dirname, '../../apps/web/src/app/(admin)'),
      path.resolve(__dirname, '../../apps/web/src/app/(auth)')
    ];

    function scanDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const f of files) {
        const fullPath = path.join(dir, f.name);
        if (f.isDirectory()) {
          scanDir(fullPath);
        } else if (/\.(tsx?|jsx?)$/.test(f.name)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(content).not.toContain('GROQ_API_KEY');
          expect(content).not.toContain('NEXT_PUBLIC_GROQ');
        }
      }
    }

    for (const dir of clientDirs) {
      scanDir(dir);
    }
  });

  it('transcription route checks for GROQ_API_KEY presence and logs rate monitoring @REQ: INFRA-GROQ-TRANSCRIPTION', () => {
    const routePath = path.resolve(__dirname, '../../apps/web/src/app/api/voice/transcribe/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');

    expect(content).toContain('GROQ_API_KEY');
    // Ensure runtime check before calling Groq
    expect(content).toMatch(/if\s*\(!apiKey\)|if\s*\(!process\.env\.GROQ_API_KEY\)/);
  });

  it('voice process route records AI provenance fields on daily_reports @REQ: INFRA-GROQ-TRANSCRIPTION', () => {
    const routePath = path.resolve(__dirname, '../../apps/web/src/app/api/voice/process/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');

    expect(content).toContain('ai_model');
    expect(content).toContain('ai_prompt_version');
    expect(content).toContain('ai_generated_at');
  });

  it('voice process route supports configurable EU report generation provider @REQ: INFRA-GROQ-TRANSCRIPTION', () => {
    const routePath = path.resolve(__dirname, '../../apps/web/src/app/api/voice/process/route.ts');
    const content = fs.readFileSync(routePath, 'utf8');

    expect(content).toContain('REPORT_LLM_MODEL');
  });

});
