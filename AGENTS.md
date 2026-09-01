# Silver Care — instrukcje dla agentów

Wspólna podstawa dla wszystkich narzędzi agentowych. Szczegóły: `.agents/rules/` i `.claude/CLAUDE.md`.

## Reguła nadrzędna

**Kontrakt w `contracts/*.contract.mjs` jest jedynym źródłem prawdy.** Kod importuje z `@silvercare/contracts`, nie przepisuje wartości. Zmiana kontraktu wymaga otwartego okna: `node tools/sc-contract-window.mjs open <REQ-ID>`.

## Czym jest ten produkt

Narzędzie komunikacji i organizacji codziennego życia placówki. **Nie jest wyrobem medycznym, systemem ratunkowym ani monitoringiem stanu zdrowia.** To przewidziane zastosowanie, od którego zależy klasyfikacja prawna całego produktu.

- Bliscy widzą: kroki, czas aktywności, długość i godziny snu.
- Bliscy nie widzą: tętna, HRV, tętna spoczynkowego, wyniku snu. Dane są zbierane i dostępne personelowi — zakaz dotyczy prezentacji.
- Wolno: „brak aktywności od czterech godzin". Nie wolno: „podejrzenie omdlenia".
- Żadna metryka nie wyzwala powiadomienia. Jedynym wyzwalaczem jest publikacja raportu.
- Słowo „pacjent" jest zakazane w warstwie widocznej dla użytkownika, łącznie z odmianą.

## Dane artykułu 9

- Zgodę wyraża pensjonariusz albo opiekun prawny. Rola `family` nie może wyrażać ani cofać zgód.
- Rejestr zgód i rejestr audytowy są niezmienialne.
- Nie loguj danych osobowych. UUID i kody techniczne — tak.
- PESEL wyłącznie jako `pesel_hash`.
- Klucz `service_role` nigdy w warstwie klienta.

## Potok głosowy

Trzy strumienie **przed** wejściem do modelu: `MEDICAL` (usuwany, zostaje w brudnopisie personelu), `DISCOMFORT` (ogólny opis w raporcie), `BEHAVIORAL` (podstawa raportu). Model nigdy nie ustala tożsamości z nagrania — `resident_id` przychodzi z frontendu jako UUID.

## Rdzeń i integracja

Rdzeń: `organizations`, `residents`. Identyfikatory dostawców żyją w `external_wearable_links` i `external_org_links`. Nazwy `care_homes`, `patients`, `polar_user_id` są porzucone.

## Pętla

```
PLAN → CONTRACT (jeśli trzeba) → RED → GREEN → VERIFY → REVIEW → INTEGRATE
```

`node tools/sc-phase.mjs red|green|contract` pilnuje granicy faz. Każdy test niesie `@REQ: <ID>`.

## Przed zamknięciem zadania

```bash
bash scripts/verify.sh --full
```

Etap POMINIĘTY to brak dowodu, nie sukces.

## Czego nie robisz sam

Otwarcie okna kontraktowego i publikacja raportu do bliskich należą do człowieka. Jesteś jednak upoważniony do samodzielnego wykonywania commitów, PR, merge i wdrożeń na wyraźne polecenie.

## Przy sprzeczności

Nie wybieraj samodzielnie. Wypisz sprzeczność z cytatem, oznacz `WYMAGA DECYZJI`, zakończ turę.
