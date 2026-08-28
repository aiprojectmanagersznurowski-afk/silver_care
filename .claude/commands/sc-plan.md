---
description: Zamień wymaganie z rejestru na Work Order gotowy do wykonania
---

Zaplanuj pracę nad wymaganiem: $ARGUMENTS

1. Ustal, którego wymagania z `contracts/requirements.contract.mjs` dotyczy `$ARGUMENTS`. Jeśli żadnego — zatrzymaj się i powiedz, że wymaganie trzeba najpierw dodać do kontraktu. To zadanie dla człowieka i contract-stewarda, nie twoje.
2. Uruchom subagenta `spec-analyst`, żeby napisał Work Order do `docs/workorders/`.
3. Pokaż mi Work Order i **zatrzymaj się**. Nie przechodź do implementacji.

Jeżeli Work Order zawiera pozycję WYMAGA DECYZJI, wypisz ją na początku podsumowania. To jest pytanie do mnie, nie do rozstrzygnięcia przez ciebie.
