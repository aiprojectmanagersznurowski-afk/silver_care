# Work Order: UI-PROFILE-DEADEND-FIX

## Metadane
- **Zadanie Trello:** `UI-PROFILE-DEADEND-FIX: Likwidacja ślepego zaułka i wpięcie nawigacji do profilu (/settings/profile)` (#175)
- **ID Karty Trello:** `6ac6a50c168d5de9e687c21e`
- **Wymagania:** `@REQ: UI-TEMPLATE-ALIGNMENT`, `@REQ: UI-ACCESSIBILITY`
- **Domena:** presentation
- **Ryzyko:** MEDIUM
- **Gałąź:** `feature/ui-profile-deadend-fix`

## Kontekst i Problem
1. Strona `/settings/profile` stanowiła dotychczas odcięty punkt (tzw. ślepy zaułek nawigacyjny) — użytkownik po wejściu na stronę profilu nie posiadał widocznego przycisku powrotu do swojego dedykowanego panelu (Admin, Staff, Rodzina).
2. Użytkownicy personelu i administratorzy korzystający z pasków bocznych (`SidebarAccount.tsx`) oraz bliscy korzystający z nagłówka (`FamilyHeader.tsx`) nie mieli bezpośredniego odnośnika w menu profilu prowadzącego do `/settings/profile`.
3. Sekcja Uwierzytelniania dwuskładnikowego (MFA / TOTP) na stronie profilu wymaga jednoznacznego oznaczenia stanu wdrożenia: informacja, że pełna konfiguracja kluczy sprzętowych / aplikacji TOTP jest planowana w kolejnym wydaniu.

## Kryteria Akceptacji
1. **AC1:** Z poziomu stopki paska bocznego personelu i administratora (`SidebarAccount.tsx`) dostępna jest opcja przejścia do `/settings/profile` ("Profil i bezpieczeństwo").
2. **AC2:** W menu użytkownika portalu rodziny (`FamilyHeader.tsx`) dostępna jest opcja przejścia do `/settings/profile`.
3. **AC3:** Na stronie `/settings/profile` znajduje się wyraźny przycisk/link powrotu ("Wróć do panelu" / `ArrowLeft`) kierujący do głównego panelu odpowiedniego dla roli użytkownika (`/admin`, `/staff`, `/dashboard`).
4. **AC4:** Sekcja MFA w `ProfileSecurityClient` zawiera czytelną etykietę informującą, że konfiguracja TOTP jest planowana w kolejnym wydaniu.
5. **AC5:** Zmiany spełniają wymogi szablonu shadcn-admin oraz reguły dostępności WCAG.
