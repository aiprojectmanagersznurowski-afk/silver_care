#!/usr/bin/env bash
# Bramka Silver Care. Etap pominięty to brak dowodu, nie sukces.
set -uo pipefail
cd "$(dirname "$0")/.."
export SC_PROJECT_DIR="$PWD"
FULL=0; CLEAN=0
for a in "$@"; do [ "$a" = "--full" ] && FULL=1; [ "$a" = "--clean" ] && CLEAN=1; done
FAIL=0; SKIP=0
step(){ printf "\n▸ %s\n" "$1"; }
ok(){ echo "  ✓ $1"; }
bad(){ echo "  ✗ $1"; FAIL=$((FAIL+1)); }
skip(){ echo "  ⊘ POMINIĘTY: $1"; SKIP=$((SKIP+1)); }

run_step(){
  local label="$1"
  shift
  local out code
  out=$("$@" 2>&1)
  code=$?
  if [ $code -eq 0 ]; then
    ok "$label"
  else
    if [ -n "$out" ]; then
      printf "%s\n" "$out"
    fi
    bad "$label"
  fi
  return $code
}

step "1/10 Spójność kontraktów"
node tools/sc-validate.mjs && ok "kontrakty spójne" || bad "sc-validate"

step "2/10 Żywotność reguł bramki"
run_step "wszystkie reguły blokują swoje mutacje" node tools/sc-selftest.mjs

step "3/10 Dryf artefaktów generowanych"
node tools/sc-codegen.mjs --check && ok "artefakty zgodne z kontraktem" || bad "dryf codegenu"
node tools/sc-port-antigravity.mjs --check && ok "konfiguracja Antigravity zgodna z Claude Code" || bad "dryf konfiguracji Antigravity"

step "4/10 Nazewnictwo rdzenia"
run_step "brak porzuconych nazw" node tools/sc-naming.mjs

step "5/10 Spójność typów TypeScript (apps/web)"
run_step "typy TypeScript poprawne" pnpm --filter web exec tsc --noEmit

step "6/10 Norma UI: typografia (min. 12px), cel dotykowy z tokenu (38px), kolory z tokenów"


# ADR-017 pkt 4 i ADR-018: te same reguły co w hookach agentów — wzorce czytane z tools/sc.config.mjs
scan_rule(){
  node --input-type=module -e '
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { kkConfig } from "./tools/guard-core.mjs";
const id = process.argv[1];
const rule = kkConfig.forbiddenPatterns.find((p) => p.id === id);
if (!rule) { console.log(`brak reguły ${id} w tools/sc.config.mjs`); process.exit(0); }
const re = new RegExp(rule.re, "g"), applies = new RegExp(rule.appliesTo);
for (const f of execSync("git ls-files apps/web/src", { encoding: "utf8" }).split("\n").filter(Boolean)) {
  if (!applies.test(f) || (rule.allowIn || []).some((a) => f.includes(a))) continue;
  // cały plik, nie linia po linii — wzorce wielolinijkowe (useViewPreference) i scope "file" (TableCard)
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(re)) {
    const line = text.slice(0, m.index).split("\n").length;
    console.log(`${f}:${line}: ${text.split("\n")[line - 1].trim().slice(0, 120)}`);
  }
}' "$1" 2>&1
}

PALETTE_VIOLATIONS=$(scan_rule ui-raw-palette)
if [ -n "$PALETTE_VIOLATIONS" ]; then
  printf "%s\n" "$PALETTE_VIOLATIONS"
  bad "znaleziono surową paletę Tailwind zamiast tokenów kontraktu w apps/web/src/ (ADR-017)"
else
  ok "brak surowej palety Tailwind w apps/web/src/ (kolory wyłącznie z tokenów)"
fi

TYPO_VIOLATIONS=$(scan_rule ui-micro-font)
if [ -n "$TYPO_VIOLATIONS" ]; then
  printf "%s\n" "$TYPO_VIOLATIONS"
  bad "znaleziono tekst poniżej 12px w apps/web/src/ (ADR-020)"
else
  ok "brak tekstu poniżej 12px w apps/web/src/ (skala szablonu, ADR-020)"
fi

TOUCH_VIOLATIONS=$(scan_rule ui-touch-target-token)
if [ -n "$TOUCH_VIOLATIONS" ]; then
  printf "%s\n" "$TOUCH_VIOLATIONS"
  bad "znaleziono cel dotykowy wpisany na sztywno zamiast min-h-touch / min-w-touch w apps/web/src/ (ADR-018)"
else
  ok "cele dotykowe wyłącznie z tokenu kontraktu (min-h-touch / min-w-touch, 38px)"
fi

# Standard ekranu (ADR-017, audyt UI): wspólne komponenty i tabela jako widok domyślny
for SCREEN_RULE in ui-default-view-table ui-own-page-heading ui-own-status-badge ui-own-table-frame ui-list-needs-table-view ui-table-cell-size; do
  SCREEN_VIOLATIONS=$(scan_rule "$SCREEN_RULE")
  if [ -n "$SCREEN_VIOLATIONS" ]; then
    printf "%s\n" "$SCREEN_VIOLATIONS"
    bad "naruszenie standardu ekranu [$SCREEN_RULE] w apps/web/src/ (ADR-017)"
  else
    ok "standard ekranu [$SCREEN_RULE] spełniony"
  fi
done

step "7/10 Limit rozmiaru plików aplikacyjnych (max 250 LOC)"
LOC_VIOLATIONS=$(find apps/web/src -type f \( -name "*.ts" -o -name "*.tsx" \) \
  ! -path "apps/web/src/types/database.types.ts" \
  ! -path "apps/web/src/components/ui/*" \
  -exec wc -l {} + | awk '$1 > 250 && $2 != "total" { print $1 " " $2 }')
if [ -n "$LOC_VIOLATIONS" ]; then
  printf "%s\n" "$LOC_VIOLATIONS"
  bad "znaleziono pliki aplikacyjne przekraczające limit 250 linii kodu w apps/web/src/"
else
  ok "wszystkie pliki aplikacyjne spełniają limit ≤ 250 LOC"
fi

step "8/10 Autentyczność testów logiki (zakaz readFileSync w tests/logic/)"
READFILE_VIOLATIONS=$(git grep -n "readFileSync" tests/logic/ 2>/dev/null || true)
if [ -n "$READFILE_VIOLATIONS" ]; then
  printf "%s\n" "$READFILE_VIOLATIONS"
  bad "znaleziono użycie readFileSync w tests/logic/ (wymagane prawdziwe testy wykonania)"
else
  ok "wszystkie testy w tests/logic/ wykonują realny kod (brak readFileSync)"
fi

step "9/10 Testy jednostkowe"
if [ -f package.json ] && command -v pnpm >/dev/null 2>&1 && grep -q '"test"' package.json 2>/dev/null; then
  run_step "testy przechodzą" pnpm test --run
else
  skip "brak pnpm albo skryptu test — aplikacja nie jest jeszcze zbudowana"
fi

step "10/10 Identyfikowalność"
if [ "$FULL" = "1" ]; then
  run_step "każdy test wskazuje wymaganie" node tools/sc-trace.mjs --enforce
else
  node tools/sc-trace.mjs | tail -3
fi

if [ "$FULL" = "1" ]; then
  step "Weryfikacja dodatkowa (--full): Linter (apps/web)"
  run_step "kod zgodny z regułami lintera" pnpm --filter web lint

  step "Weryfikacja dodatkowa (--full): Kompilacja produkcyjna Next.js (apps/web)"
  run_step "produkcyjny build Next.js poprawny" pnpm --filter web build
fi

echo ""
echo "─────────────────────────────────────────────"
if [ $FAIL -gt 0 ]; then
  echo "  BRAMKA CZERWONA — błędów: $FAIL, pominiętych: $SKIP"
  exit 1
fi
if [ $SKIP -gt 0 ]; then
  echo "  BRAMKA CZERWONA — pominiętych etapów: $SKIP"
  echo "  Pominięty etap NIE liczy się jako zaliczony — to brak dowodu."
  exit 1
fi
echo "  BRAMKA ZIELONA — wszystkie etapy wykonane."
