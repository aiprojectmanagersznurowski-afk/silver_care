# Work Order: Standard Dostępności Cyfrowej (UI-ACCESSIBILITY)

## Metadane
- **Wymagania:** `UI-ACCESSIBILITY`
- **Domena:** presentation
- **Ryzyko:** LOW
- **Powiązania:** `packages/contracts/src/ui/core.ts`, `tests/logic/ui.test.ts`, komponenty nawigacji i formularzy w `apps/web/src/`

## Cel
Spełnienie wymogów dostępności cyfrowej zgodnie z wytycznymi WCAG 2.1 na poziomie AA, ze szczególnym uwzględnieniem potrzeb osób starszych oraz osób z niepełnosprawnościami sensorycznymi i motorycznymi korzystających z aplikacji Silver Care.

## Kryteria Akceptacji
1. Wszystkie komponenty interaktywne (przyciski, linki, formularze, zakładki) posiadają czytelne etykiety dostępne dla czytników ekranu (`aria-label`, `role`, `aria-expanded`, itp.).
2. Pełna obsługa nawigacji klawiaturą (poprawne wartości `tabIndex`, widoczne focus rings bez obcinania obrysów).
3. Kontrasty kolorystyczne tekstu do tła spełniające normę co najmniej 4.5:1 dla tekstu standardowego i 3:1 dla dużego tekstu (zgodnie z tokenami design systemu "Ciepłe Zaufanie").
4. Elastyczność skalowania tekstu do 200% bez utraty funkcjonalności i nakładania się elementów interfejsu.

## Podsumowanie Realizacji
- **KONTRAKT:** Definicja interfejsu `AccessibleComponent` z wymaganymi atrybutami semantycznymi w `packages/contracts/src/ui/core.ts`.
- **IMPLEMENTACJA UI:** Prawidłowa semantyka ról ARIA w `ResidentSwitcher.tsx` (`role="tablist"` / `role="tab"`), `FamilyMessageForm.tsx` oraz widokach agendy i formularzy.
- **TESTY:** Weryfikacja atrybutów dostępności w `tests/logic/ui.test.ts` (`@REQ: UI-ACCESSIBILITY`).
