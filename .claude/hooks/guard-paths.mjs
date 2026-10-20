#!/usr/bin/env node
/**
 * PreToolUse (Edit|Write|NotebookEdit) — granice zapisu per rola agenta.
 *
 * Wywoływany z frontmattera agenta:
 *   command: "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-paths.mjs\" test-author"
 *
 * Dlaczego to jest istotne: bez tego implementer, który nie potrafi przejść testu,
 * po prostu poprawi test. Widziałem to tyle razy, ile razy tego nie zablokowano.
 * Prompt jest sugestią, exit 2 jest faktem.
 *
 * Wejście: JSON na stdin (tool_name, tool_input.file_path).
 * Wyjście: exit 0 = przepuść, exit 2 = zablokuj (stderr trafia do agenta jako powód).
 */
import { readFileSync } from 'node:fs';
import { relative, isAbsolute, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// CLAUDE_PROJECT_DIR bywa puste (zaobserwowane nawet w sesji głównej), a process.cwd()
// zależy od tego, skąd harness odpalił ten hook — dla subagenta nie musi to być korzeń
// repo. Ten plik leży w <root>/.claude/hooks/, więc korzeń wyznaczamy z jego własnej
// ścieżki, tak samo jak robi to tools/sc-contract-window.mjs (ROOT = .../<root>).
const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const PROJECT = process.env.CLAUDE_PROJECT_DIR || join(SELF_DIR, '../..');
const staticArg = process.argv[2] || 'unknown';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0); // nie blokuj z powodu własnego błędu parsowania
}

// Rola: tożsamość subagenta z payloadu hooka, jeśli jest obecna — to samo pole, które
// log-subagent.mjs już czyta poprawnie dla SubagentStart/SubagentStop (patrz run-log.jsonl).
// Dopiero w jej braku (prawdziwy wątek główny, bez subagenta) wraca statyczny argument
// z settings.json ("main-thread"). Naprawia lukę: wcześniej KAŻDY subagent wywołany przez
// narzędzie Agent/Task dostawał etykietę "main-thread", bo settings.json ma jeden globalny
// wpis hooka z argumentem na sztywno — więc żadna rola z agentWriteScopes nigdy się nie
// dopasowywała (główny wątek nie ma wpisu w agentWriteScopes = brak ograniczeń), a ścieżka
// kontraktowa była zamknięta nawet dla contract-stewarda.
const role = input.agent_type || input.agent_name || staticArg;

const raw = input?.tool_input?.file_path || input?.tool_input?.notebook_path || '';
if (!raw) process.exit(0);

const rel = (isAbsolute(raw) ? relative(PROJECT, raw) : raw).replace(/\\/g, '/');

const load = async () => {
  try {
    const mod = await import(`file://${PROJECT}/tools/sc.config.mjs`);
    return mod.config;
  } catch {
    return null;
  }
};

const cfg = await load();
if (!cfg) process.exit(0); // brak konfiguracji => nie udawaj, że pilnujesz

const matches = (path, patterns) =>
  patterns.some((p) => {
    if (p.includes('**')) {
      const re = new RegExp('^' + p.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return re.test(path);
    }
    return path.startsWith(p) || path.includes(p);
  });

const deny = (msg) => {
  process.stderr.write(`[guard-paths] ZABLOKOWANO zapis do: ${rel}\n${msg}\n`);
  process.exit(2);
};

// 1. Ścieżki kontraktowe — wymagają otwartego okna kontraktowego
if (matches(rel, cfg.contractProtectedPaths)) {
  let open = false;
  try {
    const token = JSON.parse(readFileSync(`${PROJECT}/${cfg.stateDir}/contract-window.json`, 'utf8'));
    open = new Date(token.expiresAt).getTime() > Date.now();
  } catch { open = false; }
  if (!open) {
    deny(
      `Okno kontraktowe jest zamknięte. Otwórz je świadomie:\n` +
      `    node tools/sc-contract-window.mjs open <REQ-ID>\n` +
      `Kontrakt jest źródłem prawdy — zmiana wymaga otwartego okna kontraktowego.`
    );
  }
}

process.exit(0);
