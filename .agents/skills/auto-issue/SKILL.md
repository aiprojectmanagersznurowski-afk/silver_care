---
name: auto-issue
description: >-
  Three-stage interactive-to-autonomous technical GitHub issue workflow for Silver Care:
  (1) `auto_issue` fetches ALL open issues assigned to Darek and runs local Codex healthcheck,
  (2) interactive refinement of the chosen single issue until Darek sends `start`,
  (3) full zero-prompt execution on a new `auto/issue-*` branch with local Codex plan/code gates,
  RED/GREEN/VERIFY, auto-authorized push, and open GitHub PR ready for merge.
---

# Auto-Issue — 3-Stage Autonomous Technical Delivery

Use this skill whenever Darek invokes `/auto_issue`, `auto_issue`, or asks to inspect his assigned queue and execute an issue after refinement.

## Stage 1 — `auto_issue` (Codex Check + Full Assigned List, NO coding yet)

1. Run from the workspace root:
   ```bash
   node tools/sc-auto-queue.mjs --include-codex
   ```
2. If Codex healthcheck fails (`ok: false` or Codex error), **STOP immediately** and report the error.
3. Present Codex status, detected `baseBranch`, contract-window state, and **ALL open issues assigned to Darek** (READY technical table mapped to `docs/KANONICZNA_SPECYFIKACJA_USER_STORIES.md`, plus `Wymagają okna kontraktowego` and `Pozostałe przypisane`).
4. Ask Darek to pick **one** issue number for refinement. Do NOT create branches or edit files yet.

## Stage 2 — Refinement (Interactive & Read-Only until `start`)

Once Darek picks an issue `<nr>`:

1. Inspect full issue + comments and relevant code/stories/contracts (read-only):
   ```bash
   gh issue view <nr> --json number,title,body,labels,comments,url
   ```
2. Discuss and refine with Darek until aligned:
   - exact scope and acceptance criteria;
   - impacted files (≤ 250 LOC limit) and contract / MDR / RODO Art. 9 constraints;
   - `@REQ` tags and concrete tests (unit + Playwright POM in `e2e/` for `apps/web` changes).
3. Present a concise **Refinement Summary** and ask Darek to reply **`start`** (or request tweaks). Wait explicitly for `start` before launching execution.

## Stage 3 — `start` (Full Zero-Prompt Autonomy until Open PR)

Only after Darek explicitly says **`start`**, launch `run_workflow` with zero further confirmations:

- `ScriptPath`: `<workspace-root>/.agents/skills/auto-issue/scripts/auto_issue.py`
- `Description`: `"Autonomous delivery for Silver Care #<nr>"`
- `Args`:
  ```json
  {
    "issue": 245,
    "base_branch": "<detected-baseBranch>",
    "reviewer": "aiprojectmanagersznurowski-afk",
    "refined_spec": "<concise agreed refinement brief>",
    "max_rounds": 3
  }
  ```

Inside the workflow: creates isolated worktree & branch `auto/issue-<nr>-<slug>` → Codex `plan-review` (max 3 rounds) → RED (`sc-phase red`, commit) → GREEN + `sc-phase green` + `bash scripts/verify.sh --full` (+ `pnpm test:e2e` for web) → Codex `code-review` (max 3 rounds, writes `sc-codex-approved.json`) → `git -C <wt> push -u origin <branch>` (auto-allowed by `.agents/hooks/ag-guard.mjs`) → `gh pr create` (NEVER merge). Present the PR link for final human merge decision.

## Hard Safety Boundaries & Project Settings

- **Never merge** any PR to `staging` or `main`, never push protected branches, never use `--force`, never edit `contracts/*`.
- For zero-prompt background execution, configure **Settings → Projects → `silver-care` → Permission Preset**:
  - **Recommended:** `Turbo` (disables sandbox blocking `codex`, `~/.codex`, `gh`, worktrees; `.agents/hooks/ag-guard.mjs` still enforces Silver Care push/bash safety).
  - **Alternative:** `Auto` + Allow rules for `command(git)`, `command(gh)`, `command(node)`, `command(pnpm)`, `command(bash scripts/verify.sh)`, `command(/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex)`, `read_file(/Users/Darek/.codex)`, `read_file(/Users/Darek/projekty/silver-care/.env.local)`.
