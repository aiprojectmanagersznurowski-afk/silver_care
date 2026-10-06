# Rejestr podmiotów przetwarzających (Art. 28 RODO)

> Dokument dowodowy na potrzeby audytu i IOD. **Nie jest kontraktem egzekwowanym przez bramkę** — zmiana tego pliku nie wymaga okna kontraktowego. Jeśli jednak zmiana zakresu przetwarzania u danego dostawcy ma wpływ na kod (np. włączenie nowego etapu potoku głosowego), odpowiadający wpis w `contracts/integration.contract.mjs` (`PROVIDERS`) musi być zaktualizowany osobno, w oknie kontraktowym.

**Przechowywanie oryginałów.** Podpisane umowy powierzenia (DPA) nie są przechowywane w tym repozytorium. Oryginały leżą w folderze prawnym na Dysku Google (dostęp: Michał, Darek). Ten rejestr zawiera wyłącznie metadane — referencję, zakres, daty — wystarczające do okazania podczas audytu bez ujawniania treści umowy w repozytorium kodu.

**Jak aktualizować.** Nowy wiersz przy każdym nowym dostawcy albo zmianie zakresu istniejącego DPA. Referencja dokumentu musi wskazywać realny numer/identyfikator umowy — nigdy nie zostawiaj wartości przykładowej (`TEST-xxxx`) w gałęzi scalonej do `main`.

---

## Dostawcy przetwarzający dane osobowe lub dane szczególnej kategorii (art. 9 RODO)

| Dostawca | Zakres przetwarzania | Mechanizm transferu | Referencja DPA | Data podpisania | Zatwierdził | Gdzie leży oryginał |
|---|---|---|---|---|---|---|
| Groq (GroqCloud) | `TRANSCRIBE`, `CLASSIFY`, `GENERATE` — potok notatek głosowych | SCC (Standardowe Klauzule Umowne), zerowa retencja potwierdzona ręcznie w panelu Groq | `TEST-1223` *(placeholder — podmień na realny numer/identyfikator przed scaleniem)* | `TEST-1223` *(placeholder — podmień na realną datę)* | Michał Sznurowski | Dysk Google, folder prawny Silver Care |

> ⚠️ **Ten wiersz zawiera wartości testowe.** `TEST-1223` w kolumnach „Referencja DPA" i „Data podpisania" to placeholder wstawiony na prośbę Michała, do podmiany na rzeczywisty numer dokumentu i datę podpisania przed scaleniem PR-a do `main`.

## Dostawcy bez bezpośredniego dostępu do danych szczególnej kategorii

*(Do uzupełnienia w miarę potrzeby — np. dostawca e-mail/SMS transakcyjnego, jeśli wymaga osobnego wpisu wykraczającego poza `notifications.contract.mjs`.)*

---

## Historia zmian

| Data | Zmiana |
|---|---|
| 2026-10-06 | Utworzenie rejestru. Pierwszy wpis: Groq, zakres rozszerzony o `CLASSIFY`/`GENERATE` zgodnie z addendum do ADR-009. Wartości referencji i daty jako placeholder `TEST-1223` do podmiany. |
