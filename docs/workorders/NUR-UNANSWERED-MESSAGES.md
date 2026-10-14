# WO: NUR-UNANSWERED-MESSAGES — Wskaźnik nieodpowiedzianych wiadomości na pulpicie dyżuru i odpowiedź głosowa personelu

## Metadane
- **Status:** ✅ WYKONANE
- **Story:** `SC-NUR-11` (docs/KANONICZNA_SPECYFIKACJA_USER_STORIES.md)
- **Kontrakt / Wymagania bazowe:** `NUR-BOARD`, `FAM-MESSAGES`, `INFRA-GROQ-TRANSCRIPTION`, `MDR-VOCABULARY`
- **Domena:** `staff` / `presentation` / `voice`
- **Ryzyko:** MEDIUM (rozszerzenie dashboardu dyżuru i komponentu skrzynki o nagrywanie audio)

---

## Wymaganie
Jako Pielęgniarka / Pracownik personelu na dyżurze, chcę widzieć na głównym pulpicie (`/staff`) informację o oczekujących, nieodpowiedzianych wiadomościach od rodzin podopiecznych oraz móc odpowiedzieć na nie głosowo, aby sprawnie zamykać pętlę komunikacji z bliskimi seniora bez konieczności ciągłego sprawdzania skrzynki i bez odrywania się od czynności opiekuńczych na pisanie na klawiaturze.

---

## Kontekst kodu

### Co już istnieje:
1. `apps/web/src/app/(staff)/staff/page.tsx`:
   - Pobiera listę pensjonariuszy z przypisaniami łóżek, wersjami roboczymi notatek (`voice_draft_notes`) i raportami dziennymi (`daily_reports`).
2. `apps/web/src/components/StaffBoardClient.tsx`:
   - Prezentuje kafelki pensjonariuszy w dwóch trybach (`rounds` — szybki obchód oraz `standard` — karty).
   - Zawiera filtry tokenowe (wyszukiwanie, piętro, pokój, status notatki).
   - Posiada przyciski 1-klik: dyktowanie notatki (`/voice?resident=...`) oraz szybki zapis rutynowej obserwacji (`Stan stabilny`).
3. `apps/web/src/components/StaffMessagesInbox.tsx`:
   - Skrzynka odbiorcza i konwersacje pogrupowane w wątki per pensjonariusz (`groupMessagesIntoThreads`).
   - Posiada pole tekstowe `Textarea` do wpisywania odpowiedzi do rodziny oraz wysyłkę przez `POST /api/admin/messages`.
4. `apps/web/src/app/api/voice/transcribe/route.ts`:
   - Obsługuje transkrypcję audio przez Groq Whisper (`whisper-large-v3`, język `pl`).
   - Gdy `resident_id` nie jest przekazany, zwraca czysty transkrypt w formacie `{ success: true, text, transcript }` bez tworzenia draftu notatki.
5. Tabela `public.family_messages`:
   - Pola: `id`, `organization_id`, `resident_id`, `relative_user_id`, `content`, `is_from_family`, `staff_user_id`, `created_at`.
   - Polityki RLS izolują zapytania do `organization_id`, uniemożliwiają modyfikację/usuwanie (`append-only`).

### Czego brakuje:
1. **Agregacja / flaga nieodpowiedzianych wiadomości na `/staff`:**
   - Zapytanie w `apps/web/src/app/(staff)/staff/page.tsx` nie pobiera relacji `family_messages` ani nie przekazuje flagi/licznika nieobsłużonych wiadomości.
   - Wątek uważa się za wymagający odpowiedzi, jeśli ostatnia wiadomość w wątku danego podopiecznego ma `is_from_family = true`.
2. **Wskaźnik i filtr na pulpicie (`StaffBoardClient`):**
   - Na kafelku podopiecznego (zarówno w trybie `rounds`, jak i `standard`) brak badge'a/wskaźnika „Wiadomość od rodziny” z bezpośrednim linkiem do wątku (`/staff/messages?residentId=${resident.id}`).
   - W nagłówku lub pasku filtrów brak globalnego licznika (np. badge: „2 oczekujące wiadomości”) oraz szybkiego filtra pokazującego tylko pensjonariuszy z nieodpowiedzianymi wiadomościami.
3. **Odpowiedź głosowa (dyktowanie) w `StaffMessagesInbox`:**
   - Obok pola tekstowego w formularzu odpowiedzi brak przycisku mikrofonu (`Mic`).
   - Brak modułu nagrywania audio z mikrofonu (Web Audio API / MediaRecorder) i wysyłki do `POST /api/voice/transcribe`.
   - Po transkrypcji tekst powinien trafić do pola edycji odpowiedzi (z możliwością korekty i wysłania).
4. **Automatyczne odświeżenie i zdjęcie wskaźnika:**
   - Wysłanie odpowiedzi personelu (`is_from_family = false`) powoduje, że najświeższa wiadomość pochodzi od personelu, co automatycznie wygasza stan oczekującej wiadomości.

---

## Kryteria akceptacji

### AC1: Pobieranie stanu nieodpowiedzianych wiadomości per podopieczny
- **GIVEN** zalogowany personel na `/staff`.
- **WHEN** pobierana jest lista podopiecznych placówki.
- **THEN** dla każdego podopiecznego system identyfikuje, czy ostatnia wiadomość w wątku pochodzi od rodziny (`is_from_family = true`).
- **AND** podopieczni bez wiadomości lub z ostatnią odpowiedzią personelu mają status obsłużony (`hasUnansweredMessage = false`).

### AC2: Wskaźnik na kafelku podopiecznego i bezpośrednia nawigacja
- **GIVEN** podopieczny posiadający oczekującą wiadomość od rodziny.
- **WHEN** personel przegląda pulpit `/staff` (zarówno w widoku szybkiego obchodu `rounds`, jak i widoku kart `standard`).
- **THEN** na kafelku widoczny jest wyraźny badge / wskaźnik informujący o oczekującej wiadomości z ikoną `MessageSquare`.
- **AND** kliknięcie we wskaźnik lub dedykowany przycisk przekierowuje bezpośrednio do wątku podopiecznego na `/staff/messages?residentId=<UUID>`.

### AC3: Globalny licznik i filtr oczekujących wiadomości
- **GIVEN** pulpit dyżuru `/staff` z podopiecznymi placówki.
- **WHEN** co najmniej jeden podopieczny ma nieodpowiedzianą wiadomość.
- **THEN** w pasku filtrów tokenowych lub w nagłówku widoczny jest globalny licznik oczekujących wiadomości (np. „Wiadomości: X”).
- **AND** kliknięcie filtra pozwala zawęzić listę pensjonariuszy wyłącznie do tych z oczekującą wiadomością.

### AC4: Dyktowanie odpowiedzi głosowej w skrzynce wiadomości
- **GIVEN** otwarty wątek konwersacji w `StaffMessagesInbox`.
- **WHEN** personel klika ikonę mikrofonu przy polu wprowadzania odpowiedzi.
- **THEN** uruchamia się nagrywanie dźwięku (ze wskaźnikiem trwającego nagrywania i czasem).
- **AND** zakończenie nagrania wysyła plik audio do `POST /api/voice/transcribe`.
- **AND** zwrócony transkrypt jest wstawiany do pola tekstowego odpowiedzi, umożliwiając personelowi weryfikację lub edycję przed wysłaniem.

### AC5: Wygaszenie wskaźnika po wysłaniu odpowiedzi
- **GIVEN** wątek podopiecznego z oczekującą wiadomością od rodziny.
- **WHEN** personel wyśle odpowiedź (tekstową lub podyktowaną).
- **THEN** nowa wiadomość w tabeli `family_messages` ma `is_from_family = false`.
- **AND** powrót na pulpit `/staff` natychmiast odzwierciedla brak oczekującej wiadomości dla tego podopiecznego.

### AC6: Granica MDR i bezpieczeństwo językowe
- **GIVEN** interfejs użytkownika, etykiety, transkrypcja i powiadomienia.
- **WHEN** wyświetlane są jakiekolwiek teksty dla personelu i rodziny.
- **THEN** rygorystycznie przestrzegany jest zakaz używania słowa „pacjent” (wyłącznie pensjonariusz, podopieczny, senior).
- **AND** zapytania respektują izolację organizacji (`organization_id = get_jwt_organization_id()`).

---

## Granice
- Poza zakresem: powiadomienia push lub sms przy nowej wiadomości (zgodnie z `MDR-NO-METRIC-ALARM` i `NTF-REPORT-READY`).
- Poza zakresem: automatyczne generowanie odpowiedzi przez LLM do rodziny (odpowiedź zawsze pochodzi od personelu, ewentualnie transkrybowana z głosu).
- Poza zakresem: edycja i kasowanie wysłanych wiadomości (`family_messages` jest append-only).

---

## Ryzyka i nieznane

> ⚠️ **WYMAGA DECYZJI:**
> 1. **Powiązanie kontraktowe:** W `docs/KANONICZNA_SPECYFIKACJA_USER_STORIES.md` story `SC-NUR-11` ma adnotację `🔗 Kontrakt: brak REQ`. Czy formalizujemy nowe dedykowane wymaganie `NUR-UNANSWERED-MESSAGES` w `contracts/requirements.contract.mjs` (co wymaga otwarcia okna kontraktowego przez człowieka: `node tools/sc-contract-window.mjs open NUR-UNANSWERED-MESSAGES`), CZY też przypisujemy `SC-NUR-11` do istniejących wymagań kontraktowych (`NUR-BOARD`, `FAM-MESSAGES`, `INFRA-GROQ-TRANSCRIPTION`) w linii `🔗 Kontrakt:` bez modyfikacji kontraktu?
> 2. **Metoda kalkulacji oczekujących wiadomości:** Czy stan oczekującej wiadomości wyliczamy po stronie serwera w zapytaniu Supabase (np. subselect / join w `staff/page.tsx`), czy dedykowanym widokiem / zapytaniem RPC? (Rekomendowane: subselect relacji `family_messages(id, is_from_family, created_at)` z limitem 1 na podopiecznego posortowanym malejąco po `created_at`).

---

## Weryfikacja
1. Testy jednostkowe / komponentów (Vitest):
   - Wskaźnik nieodpowiedzianej wiadomości na kafelku w `StaffBoardClient.test.tsx`.
   - Transkrypcja i wstawianie tekstu do odpowiedzi w `StaffMessagesInbox.test.tsx`.
   - Poprawne filtrowanie po oczekujących wiadomościach.
2. Test E2E Playwright:
   - Scenariusz dyżuru: rodzina wysyła wiadomość → personel widzi badge na `/staff` → przechodzi do wątku → dyktuje/wpisuje odpowiedź → badge znika.
3. Bramka jakościowa:
   - `bash scripts/verify.sh --full` (6/6 PASS).
