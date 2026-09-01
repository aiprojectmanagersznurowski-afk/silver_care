# Work Order: Wiadomości dla personelu (FAM-MESSAGES)

## Metadane
- **Wymagania:** `FAM-MESSAGES`
- **Domena:** family
- **Ryzyko:** MEDIUM

## Cel
Umożliwienie osobom bliskim zostawiania krótkich, asynchronicznych wiadomości dla personelu, zmniejszając potrzebę bezpośredniego kontaktowania się z dyżurką.

## Kryteria Akceptacji
1. Wiadomości są niezmienialne po wysłaniu (tylko APPEND, brak mutacji).
2. Limit trzech wiadomości na godzinę na konto.
3. Przekroczenie limitu wyzwala jasny i czytelny komunikat dla użytkownika.
4. Wysłanie wiadomości wymaga istnienia aktywnego powiązania (relacji) między bliskim a pensjonariuszem.

## Plan Realizacji

### 1. Baza Danych
- Tabela `family_messages` istnieje. Nie posiada polityk UPDATE ani DELETE, co spełnia kryterium "niezmienialne po wysłaniu".
- Polityka `family_messages_family_insert` weryfikuje rolę i `organization_id`, ale nie sprawdza powiązania w tabeli `resident_relative_links`. Trzeba dodać migrację (np. `20260901230000_family_messages_rls_fix.sql`), która zawęzi zasady INSERT tak, by weryfikowała istnienie powiązania.

### 2. Frontend: API (Next.js) & Logika
- Zbudowanie bezpiecznego endpointu API `POST /api/messages`.
- Walidacja limitu (częstotliwości). API najpierw sprawdzi ile wiadomości ten `auth.uid()` wysłał w ciągu ostatniej godziny (`created_at > now() - interval '1 hour'`).
- Jeśli limit jest przekroczony, API zwraca odpowiedni kod HTTP (np. 429) z czytelnym komunikatem o limicie.
- Utworzenie hooka `useSendFamilyMessage`.

### 3. Frontend: Widok Komponentu
- Stworzenie `FamilyMessageForm` (pole tekstowe i przycisk Wyślij) obsługujące błąd przekroczenia limitu z eleganckim interfejsem dla użytkownika, by uniknąć wyświetlania surowych błędów technicznych.

### 4. Testy (Vitest)
- Test bazodanowy (Vitest) potwierdzający, że rodzina nie może wysłać wiadomości dla nieswojego podopiecznego (RLS) ani usunąć wysłanej wiadomości.
- Test logiki API sprawdzający odrzucanie 4. wiadomości w ciągu tej samej godziny.
