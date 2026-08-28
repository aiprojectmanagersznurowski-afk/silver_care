---
description: Pełna pętla RED→GREEN→VERIFY→REVIEW dla zaakceptowanego Work Order
---

Wykonaj pętlę dla Work Order: $ARGUMENTS

Kolejność jest obowiązkowa. Po każdej fazie pokaż wynik i dopiero potem przejdź dalej.

**RED**
- Subagent `test-author` pisze testy z kryteriów akceptacji.
- Uruchom testy. Muszą paść z właściwego powodu — pokaż komunikat.
- `node tools/sc-phase.mjs red` — sprawdź, czy zmieniły się wyłącznie pliki testowe.

**GREEN**
- Subagent `implementer-server` albo `implementer-ui` zależnie od zakresu. Dla potoku głosowego: `voice-pipeline-architect`.
- Uruchom testy do zieleni.
- `node tools/sc-phase.mjs green` — sprawdź, czy nie ruszono testów ani kontraktu.

**VERIFY**
- `bash scripts/verify.sh --full`
- Etap POMINIĘTY to brak dowodu. Powiedz to wprost.

**REVIEW**
- Subagent `reviewer`.
- Jeśli zmiana dotyka uprawnień albo RLS — dodatkowo `rls-security-auditor`.
- Jeśli dotyka potoku głosowego, powiadomień albo portalu bliskich — dodatkowo `privacy-auditor`.

**Zatrzymaj się przed commitem.** Pokaż diff i podsumowanie. Commit należy do mnie.
