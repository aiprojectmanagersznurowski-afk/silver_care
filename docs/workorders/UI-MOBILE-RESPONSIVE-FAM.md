# Work Order: UI-MOBILE-RESPONSIVE-FAM

## Metadane
- **Zadanie:** Responsywność menu, zakładek i nawigacji Portalu Rodziny
- **Wymagania kontraktowe:** `@REQ: UI-ACCESSIBILITY`, `@REQ: UI-TEMPLATE-ALIGNMENT`
- **Domena:** presentation
- **Ryzyko:** MEDIUM
- **Trello Card:** `6ac931edd44422b53dcce4be` (Kolumna: Family FAM)

## Kontekst i Problem
1. **Martwa strefa nawigacji na tabletach (768px – 1023px):**
   W `apps/web/src/components/FamilyHeader.tsx` górne menu nawigacyjne posiadało klasę `hidden lg:flex` (widoczne od 1024px), natomiast dolny mobilny pasek nawigacji posiadał `md:hidden` (ukryty od 768px). W efekcie na tabletach (768px – 1023px, iPad pion/poziom) użytkownik nie widział żadnego menu nawigacyjnego.
2. **Kolizja z Home Indicator na iOS:**
   Dolny pasek nawigacji mobilnej (`fixed bottom-0`) nie uwzględniał bezpiecznego odstępu systemowego `env(safe-area-inset-bottom)`.
3. **Ściskanie nagłówka na małych ekranach (< 380px):**
   Logo i 3 okrągłe przyciski (motyw, powiadomienia, profil podopiecznego) przy `gap-3` i paddingach na małych telefonach powodowały ciasnotę.
4. **H-scroll na pulpicie rodziny (`FamilyDashboardClient.tsx`):**
   Pasek zakładek z `w-fit` i 3 długimi przyciskami bez `overflow-x-auto` rozpychał stronę poziomo na wąskich ekranach.

## Zakres zmian
- `FamilyHeader.tsx`: Zmiana breakpointu dolnego paska nawigacji na `lg:hidden` (lub rozszerzenie górnego), tak aby nawigacja była zawsze dostępna na tabletach (brak luki 768-1023px).
- `FamilyHeader.tsx` & `(family)/layout.tsx`: Dodanie obsługi `pb-[env(safe-area-inset-bottom)]` na dolnym pasku nawigacji i odpowiedniego bezpiecznego odstępu w layoucie.
- `FamilyDashboardClient.tsx`: Dodanie `max-w-full overflow-x-auto scrollbar-none` do kontenera zakładek, eliminując h-scroll.

## Kryteria Akceptacji (AC)
- **AC1:** Na szerokościach rzutni 768px – 1023px nawigacja Portalu Rodziny jest w 100% widoczna i klikalna.
- **AC2:** Na urządzeniach mobilnych z iOS dolny pasek nawigacji uwzględnia bezpieczny margines dolny (`safe-area-inset-bottom`).
- **AC3:** Pulpit rodziny na ekranach mobilnych 320px–375px nie generuje poziomego przewijania strony.
- **AC4:** Pełna bramka weryfikacyjna (`bash scripts/verify.sh --full`) przechodzi w 100% na zielono.
