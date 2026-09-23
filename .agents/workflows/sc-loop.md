---
description: "Pełna pętla RED→GREEN→VERIFY→REVIEW dla zaakceptowanego Work Order"
---

<!-- WYGENEROWANE z .claude/commands/sc-loop.md przez tools/sc-port-antigravity.mjs — nie edytuj ręcznie. -->

Wykonaj pętlę dla Work Order: {{args}}

Kolejność jest obowiązkowa. Po każdej fazie pokaż wynik i dopiero potem przejdź dalej.

**RED**
- subagent (invoke_subagent) `test-author` pisze testy z kryteriów akceptacji. Dla frontendu (`apps/web`): testy Playwright E2E w `e2e/` lub `e2e/roles/` z Page Object Model.
- Uruchom testy. Muszą paść z właściwego powodu — pokaż komunikat.
- `node tools/sc-phase.mjs red` — sprawdź, czy zmieniły się wyłącznie pliki testowe.

**GREEN**
- subagent (invoke_subagent) `implementer-server` albo `implementer-ui` zależnie od zakresu. Dla potoku głosowego: `voice-pipeline-architect`.
- Uruchom testy do zieleni (dla frontu: `pnpm exec playwright test <ścieżka>`).
- `node tools/sc-phase.mjs green` — sprawdź, czy nie ruszono testów ani kontraktu.

**VERIFY**
- Dla zmian frontendu: `pnpm test:e2e` (wszystkie scenariusze E2E zielone).
- `bash scripts/verify.sh --full`
- Etap POMINIĘTY to brak dowodu. Powiedz to wprost.


**REVIEW**
- subagent (invoke_subagent) `reviewer`.
- Jeśli zmiana dotyka uprawnień albo RLS — dodatkowo `rls-security-auditor`.
- Jeśli dotyka potoku głosowego, powiadomień albo portalu bliskich — dodatkowo `privacy-auditor`.

**Zatrzymaj się przed commitem.** Pokaż diff i podsumowanie. Commit należy do mnie.
