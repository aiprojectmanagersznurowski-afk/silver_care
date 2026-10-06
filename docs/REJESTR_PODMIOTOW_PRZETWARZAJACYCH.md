# Rejestr podmiotów przetwarzających (Art. 28 RODO)

> Dokument dowodowy na potrzeby audytu i IOD. **Nie jest kontraktem egzekwowanym przez bramkę** — zmiana tego pliku nie wymaga okna kontraktowego. Jeśli jednak zmiana zakresu przetwarzania u danego dostawcy ma wpływ na kod (np. włączenie nowego etapu potoku głosowego), odpowiadający wpis w `contracts/integration.contract.mjs` (`PROVIDERS`) musi być zaktualizowany osobno, w oknie kontraktowym.

**Przechowywanie oryginałów.** Podpisane umowy powierzenia (DPA) nie są przechowywane w tym repozytorium. Oryginały leżą w folderze prawnym na Dysku Google (dostęp: Michał, Darek). Ten rejestr zawiera wyłącznie metadane — referencję, zakres, daty — wystarczające do okazania podczas audytu bez ujawniania treści umowy w repozytorium kodu.

**Jak aktualizować.** Nowy wiersz przy każdym nowym dostawcy albo zmianie zakresu istniejącego DPA. Referencja dokumentu musi wskazywać realny numer/identyfikator umowy — nigdy nie zostawiaj wartości przykładowej (`TEST-xxxx`) w gałęzi scalonej do `main`. **Status `PENDING` oznacza, że dostawca nie ma jeszcze podstawy prawnej do przetwarzania rzeczywistych danych na ten zakres** — patrz kolumna „Dopuszczalne dane".

---

## Dostawcy przetwarzający dane osobowe lub dane szczególnej kategorii (art. 9 RODO)

| Dostawca | Zakres przetwarzania | Status DPA | Mechanizm transferu | Referencja DPA | Data podpisania | Zatwierdził | Dopuszczalne dane |
|---|---|---|---|---|---|---|---|
| Groq (GroqCloud) | `TRANSCRIBE` (surowe audio) | ✅ PODPISANE | SCC, zerowa retencja potwierdzona ręcznie w panelu Groq | *(do uzupełnienia realnym numerem)* | 2026-08-27 (ADR-009) | Michał Sznurowski | Rzeczywiste dane pensjonariuszy — zgodnie z ADR-009 |
| Groq (GroqCloud) | `CLASSIFY`, `GENERATE` (klasyfikacja i raport) | ⏳ **PENDING — niesfinalizowane** | Brak — DPA w trakcie negocjacji | — | — | — | **Wyłącznie dane syntetyczne/demonstracyjne**, nie rzeczywiste dane pensjonariuszy — patrz ADR-015 |

> ⚠️ **Korekta 2026-10-06.** Wcześniejsza wersja tego rejestru błędnie opisywała DPA dla `CLASSIFY`/`GENERATE` jako istniejące (placeholder `TEST-1223` sugerujący gotowy dokument). Po wyjaśnieniu z Michałem: **DPA na te dwa etapy nie jest podpisane.** System dopuszcza ich użycie przez Groq wyłącznie w jawnie włączonym trybie demonstracyjnym, bez rzeczywistych danych pensjonariuszy, do czasu podpisania DPA — zob. ADR-015 (`01-ADR-decisions.md`) i `docs/workorders/INFRA-GROQ-DEMO-INTERIM.md`.

## Dostawcy bez bezpośredniego dostępu do danych szczególnej kategorii

*(Do uzupełnienia w miarę potrzeby — np. dostawca e-mail/SMS transakcyjnego, jeśli wymaga osobnego wpisu wykraczającego poza `notifications.contract.mjs`.)*

---

## Historia zmian

| Data | Zmiana |
|---|---|
| 2026-10-06 | Utworzenie rejestru. Pierwszy wpis błędnie zakładał podpisane DPA dla `CLASSIFY`/`GENERATE` (placeholder `TEST-1223`). |
| 2026-10-06 | Korekta: DPA dla `CLASSIFY`/`GENERATE` oznaczone jako `PENDING`. Dodany osobny wiersz dla `TRANSCRIBE` (realnie podpisane, ADR-009). Nowy wiersz interim/demo z odniesieniem do ADR-015. |
