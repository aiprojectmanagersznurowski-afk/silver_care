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

step "1/6 Spójność kontraktów"
node tools/sc-validate.mjs && ok "kontrakty spójne" || bad "kk-validate"

step "2/6 Żywotność reguł bramki"
node tools/sc-selftest.mjs >/dev/null 2>&1 && ok "wszystkie reguły blokują swoje mutacje" || bad "sc-selftest"

step "3/6 Dryf artefaktów generowanych"
node tools/sc-codegen.mjs --check && ok "artefakty zgodne z kontraktem" || bad "dryf codegenu"

step "4/6 Nazewnictwo rdzenia"
node tools/sc-naming.mjs >/dev/null 2>&1 && ok "brak porzuconych nazw" || bad "sc-naming"

step "5/6 Testy jednostkowe"
if [ -f package.json ] && command -v pnpm >/dev/null 2>&1 && grep -q '"test"' package.json 2>/dev/null; then
  pnpm test --run >/dev/null 2>&1 && ok "testy przechodzą" || bad "testy jednostkowe"
else
  skip "brak pnpm albo skryptu test — aplikacja nie jest jeszcze zbudowana"
fi

step "6/6 Identyfikowalność"
if [ "$FULL" = "1" ]; then
  node tools/sc-trace.mjs --enforce >/dev/null 2>&1 && ok "każdy test wskazuje wymaganie" || bad "sc-trace"
else
  node tools/sc-trace.mjs | tail -3
fi

echo ""
echo "─────────────────────────────────────────────"
if [ $FAIL -gt 0 ]; then
  echo "  BRAMKA CZERWONA — błędów: $FAIL, pominiętych: $SKIP"
  exit 1
fi
if [ $SKIP -gt 0 ]; then
  echo "  Bramka zielona z $SKIP pominiętym etapem."
  echo "  Pominięty etap NIE liczy się jako zaliczony — to brak dowodu."
  exit 0
fi
echo "  BRAMKA ZIELONA — wszystkie etapy wykonane."
