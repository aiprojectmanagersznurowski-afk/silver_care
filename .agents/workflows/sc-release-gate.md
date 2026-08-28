---
description: "Kontrola przed wydaniem"
---

<!-- WYGENEROWANE z .claude/commands/sc-release-gate.md przez tools/sc-port-antigravity.mjs — nie edytuj ręcznie. -->

Wykonaj kontrolę przedwydaniową i pokaż wynik każdego punktu.

1. `bash scripts/verify.sh --full`
2. `node tools/sc-selftest.mjs` — czy wszystkie reguły bramki są żywe.
3. `node tools/sc-trace.mjs --enforce` — czy wymagania wysokiego ryzyka mają testy.
4. subagent (invoke_subagent) `rls-security-auditor` — pełny audyt polityk dostępu.
5. subagent (invoke_subagent) `privacy-auditor` — pełny audyt wycieków.
6. Sprawdź listę: PITR aktywne, region EU potwierdzony dla bazy, hostingu, modelu i dostawcy powiadomień, umowa powierzenia z każdym podprocesorem.

Wymaganie wysokiego ryzyka bez testu blokuje wydanie. Powiedz to wprost, jeśli takie znajdziesz.
