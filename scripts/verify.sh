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

step "6/10 Norma UI: typografia (zakaz <14px) oraz cele dotykowe (min-h ≥ 44px)"
TYPO_VIOLATIONS=$(git grep -n -E "text-xs|text-\[(8|9|10|11|12|13)px\]" apps/web/src/ 2>/dev/null || true)
if [ -n "$TYPO_VIOLATIONS" ]; then
  printf "%s\n" "$TYPO_VIOLATIONS"
  bad "znaleziono zakazane mikro-fonty (<14px) w apps/web/src/"
else
  ok "brak zakazanych mikro-fontów (<14px) w apps/web/src/"
fi

TOUCH_VIOLATIONS=$(git grep -n -E "min-h-\[(28|30|32|34|36|38|40|42)px\]" apps/web/src/ 2>/dev/null || true)
if [ -n "$TOUCH_VIOLATIONS" ]; then
  printf "%s\n" "$TOUCH_VIOLATIONS"
  bad "znaleziono cele dotykowe poniżej normy 44px (min-h < 44px) w apps/web/src/"
else
  ok "brak celów dotykowych poniżej normy 44px w apps/web/src/"
fi

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
