# Instalacja kitu Silver Care

## 0. Przeczytaj najpierw

- `docs/00-PREREQUISITES.md` — co skonfigurować, zanim agenci ruszą.
- `docs/01-ADR-decisions.md` — osiem rozstrzygnięć, na których stoi kontrakt.

## 1. Skopiuj do repozytorium

```bash
SC=~/ścieżka/do/silver-care

cp -r silver-care-agent-os/contracts   "$SC/"
cp -r silver-care-agent-os/tools       "$SC/"
cp -r silver-care-agent-os/scripts     "$SC/"
cp -r silver-care-agent-os/docs        "$SC/"
cp -r silver-care-agent-os/.githooks   "$SC/"
cp -r silver-care-agent-os/packages    "$SC/"
cp    silver-care-agent-os/AGENTS.md   "$SC/"

# Antigravity
cp -r silver-care-agent-os/.agents     "$SC/"

# Claude Code, jeśli używasz też jego
cp -r silver-care-agent-os/.claude     "$SC/"
```

## 2. Podepnij bramkę commitową

```bash
cd "$SC" && bash scripts/install-git-hooks.sh
```

Najważniejszy pojedynczy krok. Hooki IDE działają tylko wtedy, gdy plik powstaje przez agenta — commit przechodzi zawsze przez to samo miejsce.

## 3. Sprawdź, że bramka żyje

```bash
node tools/sc-validate.mjs      # spójność kontraktów
node tools/sc-selftest.mjs      # 19 reguł blokuje swoje mutacje
node tools/sc-codegen.mjs --check
node tools/sc-naming.mjs
node tools/sc-port-antigravity.mjs --check
bash scripts/verify.sh --full
```

Etap testów jednostkowych będzie POMINIĘTY, dopóki nie ma aplikacji. To poprawne — pominięcie jest raportowane jawnie, a nie ukrywane jako sukces.

## 4. Zrestartuj Antigravity

Żeby wczytało `.agents/`. Sprawdź w „…" → Customizations, czy widzisz reguły Silver Care, sześć workflowów `/sc-*` i hooki.

## 5. Doinstaluj zależności aplikacji

```bash
pnpm add -D vitest @vitest/coverage-v8 @playwright/test
pnpm exec playwright install --with-deps chromium
```

## 6. Pierwsze zadanie

```
/sc-plan ORG-ISOLATION
```

Izolacja placówek jest fundamentem — wszystkie pozostałe uprawnienia zakładają, że działa. Potem `CONSENT-GRANTOR`, potem `VOICE-ZERO-GUESSING`.

## Ważne przy pracy

Konfiguracja Antigravity jest **generowana** z `.claude/`. Edytuj `.claude/`, uruchom `node tools/sc-port-antigravity.mjs`, nigdy odwrotnie. Bramka commitowa pilnuje, żeby się nie rozjechały.
