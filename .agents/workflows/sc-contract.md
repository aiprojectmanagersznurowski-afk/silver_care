---
description: "Zmień kontrakt w otwartym oknie kontraktowym"
---

<!-- WYGENEROWANE z .claude/commands/sc-contract.md przez tools/sc-port-antigravity.mjs — nie edytuj ręcznie. -->

Zmiana kontraktu dla: {{args}}

1. `node tools/sc-contract-window.mjs` — sprawdź, czy okno jest otwarte. Jeśli nie, zatrzymaj się i powiedz, czego potrzebujesz i dlaczego.
2. subagent (invoke_subagent) `contract-steward` wprowadza zmianę.
3. `node tools/sc-codegen.mjs` — przegeneruj artefakty.
4. `node tools/sc-validate.mjs` i `node tools/sc-selftest.mjs`.
5. `node tools/sc-phase.mjs contract` — sprawdź, czy nie ruszono implementacji.
6. Pokaż mi diff kontraktu i zamknij okno: `node tools/sc-contract-window.mjs close`.

Jeżeli dodałeś regułę bramki, pokaż też mutację, która dowodzi, że reguła działa.
