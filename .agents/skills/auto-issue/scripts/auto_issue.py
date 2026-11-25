"""Autonomous Silver Care issue workflow orchestrated via run_workflow."""
import json
import os
import subprocess
import tempfile

ROOT = WORKSPACES[0] if WORKSPACES else os.getcwd()
GATE_CLI = os.path.join(ROOT, "tools/sc-codex-gate.mjs")
CORE_JS = os.path.join(ROOT, "tools/lib/auto-issue-core.mjs")

STANDING_INSTRUCTIONS = (
    "You are an autonomous Silver Care engineer working inside an isolated git worktree.\n"
    "Rules: never modify contracts/*, never open contract-window, never merge to staging/main,\n"
    "never leak medical metrics or PII, never use the word 'pacjent', keep files <= 250 LOC,\n"
    "use @REQ tags in all tests, never pass standalone '--' to pnpm test/test:db/test:e2e or playwright test (pnpm v10 forwards it verbatim),\n"
    "use PageHeader/StatusBadge/TableCard/ListEmpty in web UI,\n"
    "and use Playwright POM in e2e/ for apps/web changes. Do not ask for human approval."
)

def obj_schema(props):
    return {"type": "object", "required": list(props), "properties": props}


STR, BOOL, STR_ARR = {"type": "string"}, {"type": "boolean"}, {"type": "array", "items": {"type": "string"}}
PLAN_SCHEMA = obj_schema({
    "worktree_path": STR, "status": {"type": "string", "enum": ["READY", "BLOCKED_CONTRACT", "BLOCKED_AMBIGUOUS"]},
    "reason": STR, "plan_markdown": STR, "test_plan_markdown": STR, "req_ids": STR_ARR, "touches_web": BOOL,
})
REVISE_PLAN_SCHEMA = obj_schema({"plan_markdown": STR, "test_plan_markdown": STR, "req_ids": STR_ARR, "touches_web": BOOL})
RED_SCHEMA = obj_schema({"ok": BOOL, "reason": STR, "test_files": STR_ARR, "commit_sha": STR})
GREEN_SCHEMA = obj_schema({"verify_passed": BOOL, "e2e_ran": BOOL, "verify_summary": STR, "commit_sha": STR})
SHIP_SCHEMA = obj_schema({"pushed": BOOL, "branch": STR})


def run_cmd(cmd, cwd=ROOT, check=True):
    res = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if check and res.returncode != 0:
        raise RuntimeError(f"Command failed ({' '.join(cmd)}): {res.stderr or res.stdout}")
    return res


def comment_issue(issue_num, body):
    run_cmd(["gh", "issue", "comment", str(issue_num), "--body", body], check=False)


def run_codex_gate(subcmd, extra_args):
    res = run_cmd(["node", GATE_CLI, subcmd, *extra_args, "--json"])
    return json.loads(res.stdout)


def compute_branch(issue_num, title):
    js = "import { pathToFileURL } from 'node:url'; const { buildAutoBranchName } = await import(pathToFileURL(process.argv[1]).href); console.log(buildAutoBranchName(process.argv[2], process.argv[3]));"
    return run_cmd(["node", "--input-type=module", "-e", js, CORE_JS, str(issue_num), title]).stdout.strip()


def create_pr(issue, base_branch, branch, reviewer, refined_spec, verify_summary, plan_verdict, code_verdict):
    title = f"[#{issue['number']}] {issue['title']}"[:120]
    sections = [
        f"Closes #{issue['number']}",
        "",
        "## Weryfikacja i bramki",
        f"- `bash scripts/verify.sh --full`: {verify_summary}",
        f"- Codex `plan-review`: `{plan_verdict['verdict']}` — {plan_verdict['summary']}",
        f"- Codex `code-review`: `{code_verdict['verdict']}` — {code_verdict['summary']}",
    ]
    if refined_spec:
        sections.extend(["", "## Uzgodniony refinement", refined_spec])
    body_text = "\n".join(sections) + "\n"
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as tf:
        tf.write(body_text)
        body_path = tf.name
    try:
        base_cmd = ["gh", "pr", "create", "--base", base_branch, "--head", branch, "--title", title, "--body-file", body_path]
        res = run_cmd([*base_cmd, "--reviewer", reviewer], check=False)
        if res.returncode != 0:
            with open(body_path, "w") as f:
                f.write(body_text + f"\nReviewer: @{reviewer}\n")
            res = run_cmd(base_cmd, check=True)
        return res.stdout.strip().splitlines()[-1].strip()
    finally:
        if os.path.exists(body_path):
            os.unlink(body_path)


async def process_issue(issue_num, base_branch, reviewer, max_rounds, refined_spec=""):
    phase(f"Issue #{issue_num}")
    issue = json.loads(run_cmd(["gh", "issue", "view", str(issue_num), "--json", "number,title,body,labels,url"]).stdout)
    branch = compute_branch(issue_num, issue["title"])
    log(f"Starting #{issue_num}: {issue['title']} -> branch {branch}")
    ref_block = f"\n\n=== AGREED REFINEMENT ===\n{refined_spec}" if refined_spec else ""

    worker = agent(STANDING_INSTRUCTIONS, role=f"Issue #{issue_num}", workspace="share")
    try:
        t1 = await worker(
            f"1. Run `pwd` (this is worktree_path). Bootstrap branch `{branch}` from `origin/{base_branch}`:\n"
            f"   `git fetch origin {base_branch} && git checkout -B {branch} origin/{base_branch}`\n"
            f"2. If `.env.local` is missing, locate main repo via `git rev-parse --git-common-dir` parent and copy `.env.local` if present. "
            f"If `node_modules` is missing, run `pnpm install --frozen-lockfile --prefer-offline`.\n"
            f"3. Inspect codebase, `docs/KANONICZNA_SPECYFIKACJA_USER_STORIES.md`, and `contracts/` for Issue #{issue_num}:\n"
            f"Title: {issue['title']}\nBody:\n{issue['body'] or '(empty)'}{ref_block}\n\n"
            f"4. Produce a detailed implementation plan and test specification (@REQ tags, Playwright POM if apps/web) honoring the agreed refinement.\n"
            f"Return status BLOCKED_CONTRACT if contracts/* edits are required, BLOCKED_AMBIGUOUS on contract contradiction, else READY.",
            PLAN_SCHEMA,
        )
        wt = t1["worktree_path"]
        if t1["status"] != "READY":
            msg = f"🤖 Auto-issue zatrzymane przed wdrożeniem (`{t1['status']}`): {t1['reason']}"
            comment_issue(issue_num, msg)
            return {"issue": issue_num, "status": t1["status"], "reason": t1["reason"]}

        plan_md, test_md, touches_web = t1["plan_markdown"], t1["test_plan_markdown"], t1["touches_web"]
        with tempfile.TemporaryDirectory(prefix="sc-auto-plan-") as tmpdir:
            issue_file = os.path.join(tmpdir, "issue.md")
            plan_file = os.path.join(tmpdir, "plan.md")
            with open(issue_file, "w") as f:
                f.write(f"# #{issue_num} {issue['title']}\n\n{issue['body'] or ''}\n")
                if refined_spec:
                    f.write(f"\n## Agreed Refinement Decisions\n{refined_spec}\n")

            plan_verdict = None
            for rnd in range(1, max_rounds + 1):
                with open(plan_file, "w") as f:
                    f.write(f"## Plan\n{plan_md}\n\n## Test Plan\n{test_md}\n")
                plan_verdict = run_codex_gate("plan-review", ["--repo", wt, "--issue", str(issue_num), "--plan-file", plan_file, "--issue-file", issue_file])
                log(f"Codex plan-review round {rnd}: {plan_verdict['verdict']} — {plan_verdict['summary']}")
                if plan_verdict["verdict"] == "APPROVED":
                    break
                if plan_verdict["verdict"] in ("BLOCKED_CONTRACT", "BLOCKED_AMBIGUOUS") or rnd == max_rounds:
                    reason = "; ".join(plan_verdict["blocking_issues"]) or plan_verdict["summary"]
                    comment_issue(issue_num, f"🤖 Codex plan-review zatrzymał zadanie (`{plan_verdict['verdict']}`): {reason}")
                    return {"issue": issue_num, "status": plan_verdict["verdict"], "reason": reason}
                rev = await worker(
                    f"Codex plan-review requested revisions (round {rnd}/{max_rounds}):\n"
                    f"Blocking: {json.dumps(plan_verdict['blocking_issues'], ensure_ascii=False)}\n"
                    f"Suggestions: {json.dumps(plan_verdict['suggestions'], ensure_ascii=False)}\n"
                    f"Revise plan_markdown and test_plan_markdown to resolve every item.",
                    REVISE_PLAN_SCHEMA,
                )
                plan_md, test_md, touches_web = rev["plan_markdown"], rev["test_plan_markdown"], rev["touches_web"]

        red = await worker(
            f"RED PHASE ONLY for #{issue_num}:\n"
            f"Write ONLY the approved test files from:\n{test_md}\n"
            f"Run the new tests and confirm they FAIL for the expected reason.\n"
            f"Run `node tools/sc-phase.mjs red` (must exit 0), then run `git add -A && git commit -m \"test: RED tests for #{issue_num}\"`.",
            RED_SCHEMA,
        )
        if not red["ok"]:
            comment_issue(issue_num, f"🤖 Faza RED nie powiodła się: {red['reason']}")
            return {"issue": issue_num, "status": "BLOCKED_RED", "reason": red["reason"]}

        e2e_note = " and `pnpm test:e2e`" if touches_web else ""
        green = await worker(
            f"GREEN + VERIFY PHASE for #{issue_num}:\n"
            f"Implement the approved plan (do NOT edit test files or contracts/*; keep files <= 250 LOC):\n{plan_md}\n"
            f"1. Run targeted tests to GREEN.\n"
            f"2. Run `node tools/sc-phase.mjs green` BEFORE committing (must exit 0).\n"
            f"3. Commit with `git add -A && git commit -m \"feat: implement #{issue_num}\"`.\n"
            f"4. Run `bash scripts/verify.sh --full`{e2e_note}. Fix any failures (up to {max_rounds} attempts), commit fixes, and return final result.",
            GREEN_SCHEMA,
        )
        if not green["verify_passed"]:
            comment_issue(issue_num, f"🤖 Bramka `verify.sh --full` nie przeszła: {green['verify_summary']}")
            return {"issue": issue_num, "status": "BLOCKED_VERIFY", "reason": green["verify_summary"]}

        verify_summary = green["verify_summary"]
        code_verdict = None
        for rnd in range(1, max_rounds + 1):
            code_verdict = run_codex_gate(
                "code-review",
                ["--repo", wt, "--issue", str(issue_num), "--base", f"origin/{base_branch}", "--verify-passed", "--verify-summary", verify_summary],
            )
            log(f"Codex code-review round {rnd}: {code_verdict['verdict']} — {code_verdict['summary']}")
            if code_verdict["verdict"] == "APPROVED":
                break
            if code_verdict["verdict"] == "BLOCKED_CONTRACT" or rnd == max_rounds:
                reason = "; ".join(code_verdict["blocking_issues"]) or code_verdict["summary"]
                comment_issue(issue_num, f"🤖 Codex code-review nie zatwierdził zmian (`{code_verdict['verdict']}`): {reason}")
                return {"issue": issue_num, "status": code_verdict["verdict"], "reason": reason}
            fix = await worker(
                f"Codex code-review requested changes (round {rnd}/{max_rounds}):\n"
                f"Blocking: {json.dumps(code_verdict['blocking_issues'], ensure_ascii=False)}\n"
                f"Suggestions: {json.dumps(code_verdict['suggestions'], ensure_ascii=False)}\n"
                f"Fix all issues, re-run `bash scripts/verify.sh --full`{e2e_note}, and commit fixes (`git add -A && git commit -m \"fix: address codex review for #{issue_num}\"`).",
                GREEN_SCHEMA,
            )
            if not fix["verify_passed"]:
                comment_issue(issue_num, f"🤖 Bramka `verify.sh --full` nie przeszła po poprawkach Codexa: {fix['verify_summary']}")
                return {"issue": issue_num, "status": "BLOCKED_VERIFY", "reason": fix["verify_summary"]}
            verify_summary = fix["verify_summary"]

        ship = await worker(
            f"SHIP PHASE for #{issue_num}:\n"
            f"Run ONLY: `git -C {wt} push -u origin {branch}` (Codex receipt is ready in git dir).\n"
            f"Do NOT create or merge any PR yourself.",
            SHIP_SCHEMA,
        )
        if not ship["pushed"]:
            raise RuntimeError(f"Push failed for branch {branch}")
        pr_url = create_pr(issue, base_branch, branch, reviewer, refined_spec, verify_summary, plan_verdict, code_verdict)
        return {"issue": issue_num, "status": "SHIPPED", "branch": ship["branch"], "pr_url": pr_url, "verify": verify_summary}
    finally:
        del worker


async def main():
    raw_issues = [args["issue"]] if args.get("issue") is not None else args.get("issues", [])
    issues = [int(i) for i in raw_issues]
    if not issues:
        raise ValueError("Provide args['issue'] or non-empty args['issues'].")
    base_branch = args.get("base_branch", "staging")
    reviewer = args.get("reviewer", "aiprojectmanagersznurowski-afk")
    max_rounds = int(args.get("max_rounds", 3))
    refined_spec = str(args.get("refined_spec", "")).strip()

    phase("Pre-flight Codex")
    health = run_codex_gate("healthcheck", [])
    if not health.get("ok"):
        raise RuntimeError(f"Codex healthcheck failed: {health}")
    log(f"Codex healthy: {health.get('version')} ({health.get('latencyMs')}ms)")

    results = await pipeline(issues, lambda num: process_issue(num, base_branch, reviewer, max_rounds, refined_spec))
    phase("Session Report")
    completed = [r for r in results if r["status"] == "SHIPPED"]
    blocked = [r for r in results if r["status"] != "SHIPPED"]
    log(json.dumps({"completed": completed, "blocked": blocked}, indent=2, ensure_ascii=False))
    print(json.dumps({"completed": completed, "blocked": blocked}, indent=2, ensure_ascii=False))


await main()
