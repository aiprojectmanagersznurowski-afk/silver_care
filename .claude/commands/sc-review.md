---
description: Recenzja zmian przed scaleniem
---

Zrecenzuj bieżące zmiany.

1. Zgodność z Work Order, kontraktem i granicą MDR.
2. Brak wycieków danych osobowych i medycznych do logów, powiadomień, promptów i warstwy bliskich (`daily_reports`).
3. Jeśli diff dotyka polityk dostępu lub RPC — audyt RLS, `SECURITY INVOKER` i weryfikacji `auth.uid()`.

Zbierz uwagi w dwie listy: blokujące i sugestie. Blokująca to naruszenie kontraktu, granicy MDR albo ochrony danych.
