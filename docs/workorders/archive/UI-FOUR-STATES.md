# Work Order: Standard 4 Stanów UI (UI-FOUR-STATES)

## Metadane
- **Wymagania:** `UI-FOUR-STATES`
- **Domena:** presentation
- **Ryzyko:** LOW
- **Powiązania:** `packages/contracts/src/ui/core.ts`, `tests/logic/ui.test.ts`, komponenty i strony w `apps/web/src/`

## Cel
Wprowadzenie i egzekwowanie jednolitego standardu obsługi 4 stanów interfejsu użytkownika (Loading, Empty, Error, Success) we wszystkich kluczowych widokach i komponentach aplikacji Silver Care, gwarantując niezawodność, czytelność i poczucie spokoju dla użytkowników (rodzin i personelu).

## Kryteria Akceptacji
1. Kontrakt bazowy precyzuje 4 stany widoku: `loading`, `empty`, `error`, `success`.
2. Każdy widok asynchroniczny i komponent pobierający dane implementuje dedykowaną reprezentację dla:
   - `loading`: szkielety ładujące (skeletons) lub subtelne wskaźniki bez skoków layoutu,
   - `empty`: ciepły, informacyjny komunikat wyjaśniający brak danych (zgodny z tone-of-voice "Ciepłe Zaufanie") oraz opcjonalny przycisk akcji,
   - `error`: bezpieczny komunikat o błędzie z możliwością ponowienia operacji,
   - `success`: pełna prezentacja danych z zachowaniem hierarchii i tokenów wizualnych.
3. Brak nieobsługiwanych stanów zawieszenia czy pustych białych ekranów.

## Podsumowanie Realizacji
- **KONTRAKT:** Typ `UIState` (`'loading' | 'empty' | 'error' | 'success'`) zdefiniowany w `packages/contracts/src/ui/core.ts`.
- **KOMPONENTY I WIDOKI:** Zaimplementowano 4 stany w portalu rodziny (`agenda`, `messages`, `dashboard`, `register`) oraz panelach personelu i administracji.
- **TESTY:** Zapewniono pokrycie w `tests/logic/ui.test.ts` (`@REQ: UI-FOUR-STATES`).
