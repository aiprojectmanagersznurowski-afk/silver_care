# Work Order: Wielu Pensjonariuszy (FAM-MULTI-RESIDENT)

## Metadane
- **Wymagania:** `FAM-MULTI-RESIDENT`
- **Domena:** family
- **Ryzyko:** MEDIUM
- **Powiązania:** `ResidentSwitcher.tsx`, `contracts/requirements.contract.mjs`

## Cel
Umożliwienie osobom bliskim posiadającym więcej niż jednego podopiecznego w placówce (np. oboje rodziców) płynnego i bezpiecznego przełączania kontekstu bez konieczności ponownego logowania.

## Kryteria Akceptacji
1. Przełącznik podopiecznych pojawia się w interfejsie wyłącznie wtedy, gdy konto rodziny posiada więcej niż jedno aktywne powiązanie w `resident_relative_links`.
2. Wybór podopiecznego natychmiast przeładowuje kontekst aplikacji (dashboard, raporty, agenda, wiadomości) wyłącznie dla wybranego seniora.
3. Stan aktywnego wyboru jest bezpiecznie utrwalany (ciasteczko sesyjne `family_resident_id`).

## Podsumowanie Realizacji
- **KOMPONENT:** W `apps/web/src/components/ResidentSwitcher.tsx` zaimplementowano przełącznik z obsługą dostępności (`role="tablist"`), który ukrywa się automatycznie przy `residents.length <= 1`.
- **UKŁAD:** W `apps/web/src/app/(family)/layout.tsx` zintegrowano odczyt aktywnego seniora z ciasteczka `family_resident_id`.
- **TESTY:** `tests/logic/multi_resident.test.ts` oraz `tests/logic/ui.test.ts` weryfikują warunki renderowania przełącznika i izolację danych (`@REQ: FAM-MULTI-RESIDENT`).

