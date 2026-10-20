---
description: "Pełna pętla RED→GREEN→VERIFY→REVIEW dla zaakceptowanego Work Order"
---

<!-- WYGENEROWANE z .claude/commands/sc-loop.md przez tools/sc-port-antigravity.mjs — nie edytuj ręcznie. -->

Wykonaj pętlę dla Work Order: {{args}}

Kolejność jest obowiązkowa. Po każdej fazie pokaż wynik i dopiero potem przejdź dalej.

**RED**
- Napisz testy z kryteriów akceptacji (każdy ze znacznikiem `@REQ: <ID>`). Dla frontendu (`apps/web`): testy Playwright E2E w `e2e/` lub `e2e/roles/` z Page Object Model.
- Uruchom testy. Muszą paść z właściwego powodu — pokaż komunikat.
- `node tools/sc-phase.mjs red` — sprawdź, czy zmieniły się wyłącznie pliki testowe.

**GREEN**
- Wdróż implementację zgodnie z kontraktem (limit rozmiaru pliku ≤ 250 LOC, brak `any`, norma UI Mobile-First).
- Uruchom testy do zieleni (dla frontu: `pnpm exec playwright test <ścieżka>`).
- `node tools/sc-phase.mjs green` — sprawdź, czy nie ruszono testów ani kontraktu.

**VERIFY**
- Dla zmian frontendu: `pnpm test:e2e` (wszystkie scenariusze E2E zielone).
- `bash scripts/verify.sh --full`
- Etap POMINIĘTY to brak dowodu. Powiedz to wprost.

**REVIEW**
- Przeprowadź przegląd zgodności z Work Order, kontraktem i granicą MDR.
- Jeśli zmiana dotyka uprawnień albo RLS — zweryfikuj polityki dostępu oraz izolację organizacji.
- Jeśli dotyka potoku głosowego, powiadomień albo portalu bliskich — zweryfikuj brak wycieków PII i danych medycznych (Art. 9 RODO).

**Zatrzymaj się przed commitem.** Pokaż diff i podsumowanie. Commit należy do mnie.
