---
description: "Recenzja zmian przed scaleniem"
---

<!-- WYGENEROWANE z .claude/commands/sc-review.md przez tools/sc-port-antigravity.mjs — nie edytuj ręcznie. -->

Zrecenzuj bieżące zmiany.

1. subagent (invoke_subagent) `reviewer` — zgodność z Work Order, kontraktem i granicą MDR.
2. subagent (invoke_subagent) `privacy-auditor` — wycieki danych osobowych do logów, powiadomień, promptów i warstwy bliskich.
3. Jeśli diff dotyka polityk dostępu — subagent (invoke_subagent) `rls-security-auditor`.

Zbierz uwagi w dwie listy: blokujące i sugestie. Blokująca to naruszenie kontraktu, granicy MDR albo ochrony danych.
