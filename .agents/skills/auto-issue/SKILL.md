---
name: auto-issue
description: >-
  Autonomous technical GitHub issue execution for Silver Care with mandatory Codex
  healthcheck and user-story queue inspection before start, local Codex plan/test and
  code reviews, RED/GREEN/VERIFY gating, auto-authorized feature branch push, and PR creation.
  Use when Darek asks to inspect or automatically execute assigned technical issues.
---

# Auto-Issue — Autonomous Technical Delivery with Local Codex Gates

Use this skill whenever Darek asks to run autonomous issue delivery, verify the technical queue, or execute assigned GitHub issues end-to-end.

## Stage 1 — Mandatory Pre-flight (ALWAYS before execution)

Never skip this stage, even when asked for full autonomy. Before launching any development workflow:

1. Run the pre-flight CLI from the workspace root (pass `--base <branch>` when working off an active branch such as `codex/nowe-zmiany`):
   ```bash
   node tools/sc-auto-queue.mjs --include-codex [--base codex/nowe-zmiany]
   ```
2. **Verify Codex availability first:**
   - If Codex does not respond (`ok: false` or non-zero exit with Codex error), **STOP immediately** and report the exact diagnostic error. Do not start development without Codex.
3. **Review queue and canonical stories with Darek:**
   - Present the Codex health status (`version`, `latencyMs`, `maxRounds`), detected base branch (e.g. `staging`), and contract-window state.
   - Present the `READY` technical issues table mapped to `docs/KANONICZNA_SPECYFIKACJA_USER_STORIES.md` (with story status emojis and `do-weryfikacji` markers), alongside `NEEDS_CONTRACT` and `EXCLUDED` issues (e.g. `typ:biznes`, `[SPIKE-*]`, open PRs).
   - Highlight the recommended issue(s) and ask Darek to confirm which issue number(s) and order to execute.

## Stage 2 — Full Autonomy (after Darek confirms queue)

Once Darek confirms the issue number(s), execute **with zero intermediate approval prompts**:

1. Launch `run_workflow` using:
   - `ScriptPath`: `<workspace-root>/.agents/skills/auto-issue/scripts/auto_issue.py`
   - `Description`: `"Autonomous delivery for Silver Care issues: <numbers>"`
   - `Args`:
     ```json
     {
       "issues": [245],
       "base_branch": "staging",
       "reviewer": "aiprojectmanagersznurowski-afk",
       "max_rounds": 3
     }
     ```
2. Inside the workflow, each issue runs sequentially in an isolated shared worktree on branch `auto/issue-<nr>-<slug>`:
   - **Plan & Tests** → verified locally by `node tools/sc-codex-gate.mjs plan-review` (up to 3 rounds).
   - **RED** → write `@REQ`-tagged tests (Playwright POM in `e2e/` for `apps/web`), confirm failure, run `node tools/sc-phase.mjs red`, commit.
   - **GREEN + VERIFY** → implement (≤ 250 LOC/file, MDR/UI rules), pass tests, run `node tools/sc-phase.mjs green`, commit, pass `bash scripts/verify.sh --full` (+ `pnpm test:e2e` for web changes).
   - **Code Review** → verified locally by `node tools/sc-codex-gate.mjs code-review` (up to 3 rounds). On `APPROVED`, writes a commit-bound receipt (`sc-codex-approved.json`) in the worktree git dir.
   - **Ship** → pushes `auto/issue-<nr>-<slug>` (auto-allowed by `.agents/hooks/ag-guard.mjs` when receipt matches `HEAD` SHA) and opens a GitHub PR targeting `base_branch` with `@aiprojectmanagersznurowski-afk` as reviewer.

## Hard Safety Boundaries

- **Never merge** any PR to `staging` or `main` (human review only).
- **Never edit `contracts/*`** or open a contract window autonomously; block and comment on the GitHub issue instead.
- **Never push** to `main`, `master`, or `staging`, and never use `--force`.

## Required Antigravity Project Settings (for zero-prompt background runs)

Because `run_workflow` rejects tool calls that prompt for confirmation, configure **Settings → Projects → `silver-care` → Permission Preset** (or the permissions picker above the chat box):

- **Recommended (`Turbo`)**: disables the terminal sandbox and allows external binary/config access (`codex` in `/Applications/ChatGPT.app/...`, `~/.codex`, `gh` Keychain/network, worktrees). Silver Care safety rules and `git push` restrictions remain enforced by `.agents/hooks/ag-guard.mjs`.
- **Stricter alternative (`Auto`)**: keep `Auto` preset and add explicit project **Allow** rules: `command(git)`, `command(gh)`, `command(node)`, `command(pnpm)`, `command(bash scripts/verify.sh)`, `command(/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex)`, `read_file(/Users/Darek/.codex)`, `read_file(/Users/Darek/projekty/silver-care/.env.local)`.
