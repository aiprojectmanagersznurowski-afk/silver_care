# Work Order: ADM-ARCHIVE

## Metadane
- **Wymaganie:** `ADM-ARCHIVE` (Zarządzanie archiwizacją rezydenta i danymi)
- **Domena:** residents
- **Ryzyko:** HIGH
- **Zależności:** `ADM-RESIDENT-ADD`

## Cel
Dostarczenie mechanizmu archiwizacji pensjonariuszy, który jest niszczący w kontekście dostępu bliskich, lecz zachowawczy w kontekście śladu audytowego i dostępu personelu (read-only). Wymaganie nakazuje również obsługę "twardego usunięcia", które w istocie polega na usunięciu rezydenta z głównej tabeli i jednoczesnej redakcji (anonimizacji) jego danych z logów audytowych.

## Kryteria Akceptacji
1. `archived_at` ukrywa pensjonariusza przed bliskimi natychmiast.
2. Personel zachowuje wyłącznie odczyt.
3. Ingest odrzuca nowe dane dla zarchiwizowanego pensjonariusza.
4. Twarde usunięcie redaguje dane osobowe w `audit_logs` zamiast kasować wpisy.

## Plan Realizacji (Baza Danych - PostgreSQL)

### 1. Rozbudowa RLS na `residents` (KA 1 i 2)
- Obecnie personel (`org_admin`) ma prawo UPDATE na `residents`. Zmodyfikujemy warunek `WITH CHECK` by zablokować jakiekolwiek modyfikacje, jeśli rezydent miał już `archived_at IS NOT NULL`. Oraz pozwolimy jedynie na akcję nadawania daty `archived_at`. Aby zapobiec zmianom w innych polach podczas archiwizowania, użyjemy triggera lub zaostrzymy RLS. Najbezpieczniejszy będzie trigger zdejmujący z `OLD` wszystko z wyjątkiem `archived_at`.

### 2. Tabela `audit_logs` i redakcja (KA 4)
- Ponieważ tabela `audit_logs` dotąd nie powstała w MVP, dodamy jej definicję: `id`, `organization_id`, `resident_id` (opcjonalnie nullable po usunięciu), `action`, `performed_by`, `payload` (JSONB).
- Funkcja `hard_delete_resident(p_id)` uruchamiająca proces:
  1. Redaguje `audit_logs` dla podanego ID (np. nadpisując payload przez `{"redacted": true}`).
  2. Wykonuje `DELETE FROM residents WHERE id = p_id`.

### 3. Zabezpieczenie przed Ingest (KA 3)
- Ponieważ moduł Ingest jeszcze nie istnieje, nie mamy tabel ingestowych. Aby udowodnić spełnienie kryterium z kontraktu, stworzymy przykładową tabelę `physiological_data_ingest` i nałożymy na nią RLS blokujące zapisy (lub trigger odrzucający), jeżeli `residents.archived_at IS NOT NULL`. 

### 4. Testy (Vitest)
Dodanie pliku `tests/db/archive.test.ts`:
- Odmowa edycji imienia zarchiwizowanego rezydenta.
- Zablokowanie wstawienia metryki (`physiological_data_ingest`) dla zarchiwizowanego.
- Udowodnienie działania RPC `hard_delete_resident`: logi w `audit_logs` pozostają, ale tracą dane (i tracą bezpośredni UUID, jeśli tak zdecydujemy), a sam rezydent znika.

## Otwarte Pytania / WYMAGA DECYZJI
- Brak, wdrażamy z opcją zautomatyzowaną.
