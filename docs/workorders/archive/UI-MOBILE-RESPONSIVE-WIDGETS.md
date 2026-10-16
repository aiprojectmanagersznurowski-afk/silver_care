# Work Order: UI-MOBILE-RESPONSIVE-WIDGETS

## Metadane
- **Zadanie:** Responsywność widgetu czatu, nagłówków administracyjnych i selektorów
- **Wymagania kontraktowe:** `@REQ: UI-ACCESSIBILITY`, `@REQ: UI-TEMPLATE-ALIGNMENT`
- **Domena:** presentation
- **Ryzyko:** LOW
- **Trello Card:** `6ac931eff9785ece74909e58` (Kolumna: Presentation MDR/UI)

## Kontekst i Problem
1. **Wystawanie widgetu czatu poza ekran:**
   W `apps/web/src/components/CommunicationWidget.tsx` sztywna wysokość `h-[540px]` w połączeniu z pozycją `bottom-20` (80px) sprawia, że na mniejszych ekranach (< 667px) okno czatu wystaje poza górną krawędź okna przeglądarki.
2. **Ściskanie nagłówka w rejestrze zaproszeń:**
   W `apps/web/src/app/(admin)/admin/invitations/page.tsx` nagłówek posiada `flex items-center justify-between` bez responsywnego łamania wiersza `flex-col sm:flex-row`, co powoduje ściskanie tytułu z przyciskiem akcji.
3. **Sztywna minimalna szerokość w raporcie dziennym:**
   W `apps/web/src/components/DailyReportClient.tsx` nagłówek wyboru miesiąca posiada `min-w-48 text-center`, co na bardzo małych ekranach może powodować niepożądane rozpychanie kontrolek.

## Zakres zmian
- `CommunicationWidget.tsx`: Uelastycznienie wysokości okna z wykorzystaniem `max-h-[calc(100dvh-6.5rem)]` i `h-[540px]`.
- `admin/invitations/page.tsx`: Użycie `flex flex-col sm:flex-row sm:items-center justify-between gap-4`.
- `DailyReportClient.tsx`: Elastyczne dopasowanie nagłówka daty na ekranach mobilnych.

## Kryteria Akceptacji (AC)
- **AC1:** Okno komunikatora rodziny mieści się w całości w rzutni na ekranach o ograniczonej wysokości.
- **AC2:** Nagłówek strony zaproszeń zachowuje czytelny, responsywny układ na urządzeniach mobilnych.
- **AC3:** Pełna bramka weryfikacyjna (`bash scripts/verify.sh --full`) przechodzi w 100% na zielono.
