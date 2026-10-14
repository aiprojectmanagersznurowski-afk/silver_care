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

step "1/7 Spójność kontraktów"
node tools/sc-validate.mjs && ok "kontrakty spójne" || bad "sc-validate"

step "2/7 Żywotność reguł bramki"
run_step "wszystkie reguły blokują swoje mutacje" node tools/sc-selftest.mjs

step "3/7 Dryf artefaktów generowanych"
node tools/sc-codegen.mjs --check && ok "artefakty zgodne z kontraktem" || bad "dryf codegenu"

step "4/7 Nazewnictwo rdzenia"
run_step "brak porzuconych nazw" node tools/sc-naming.mjs

step "5/7 Spójność typów TypeScript (apps/web)"
run_step "typy TypeScript poprawne" pnpm --filter web exec tsc --noEmit

step "6/7 Testy jednostkowe"
if [ -f package.json ] && command -v pnpm >/dev/null 2>&1 && grep -q '"test"' package.json 2>/dev/null; then
  run_step "testy przechodzą" pnpm test --run
else
  skip "brak pnpm albo skryptu test — aplikacja nie jest jeszcze zbudowana"
fi

step "7/7 Identyfikowalność"
if [ "$FULL" = "1" ]; then
  run_step "każdy test wskazuje wymaganie" node tools/sc-trace.mjs --enforce
else
  node tools/sc-trace.mjs | tail -3
fi

if [ "$FULL" = "1" ]; then
  step "Weryfikacja dodatkowa (--full): Linter (apps/web)"
  run_step "kod zgodny z regułami lintera" pnpm --filter web lint
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
