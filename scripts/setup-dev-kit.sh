#!/usr/bin/env bash
# Silver Care — Development Kit Setup & Verification
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=================================================="
echo " Silver Care — Development Kit Setup"
echo "=================================================="

echo "▸ 1. Weryfikacja środowiska bazowego..."
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 20 ]; then
  echo "  ✗ Wymagany Node.js w wersji >= 20 (wykryto: $(node -v))"
  exit 1
fi
echo "  ✓ Node.js $(node -v) OK"

if ! command -v pnpm &> /dev/null; then
  echo "  ✗ pnpm nie jest zainstalowany. Zainstaluj: npm install -g pnpm"
  exit 1
fi
echo "  ✓ pnpm $(pnpm -v) OK"

echo "▸ 2. Instalacja zależności monorepo..."
pnpm install

echo "▸ 3. Konfiguracja git hooks..."
git config core.hooksPath .githooks
chmod +x .githooks/* || true
echo "  ✓ Git hooks skonfigurowane w .githooks"

echo "▸ 4. Generowanie artefaktów z kontraktów..."
node tools/sc-codegen.mjs
node tools/sc-validate.mjs

echo "▸ 5. Synchronizacja reguł agentowych (Antigravity & Claude Code)..."
node tools/sc-port-antigravity.mjs

echo "▸ 6. Weryfikacja spójności..."
bash scripts/verify.sh

echo ""
echo "=================================================="
echo " ✓ Środowisko Silver Care w pełni skonfigurowane!"
echo "=================================================="
