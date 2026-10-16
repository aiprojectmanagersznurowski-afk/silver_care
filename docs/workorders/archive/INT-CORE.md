# Work Order: Rdzeń systemu bez zależności od dostawców zewnętrznych

## Metadane
- **Wymagania:** `INT-CORE-DECOUPLED`
- **Domena:** integration
- **Ryzyko:** HIGH

## Kontekst
Architektura aplikacji wymaga, aby baza rdzenia nie miała żadnej bezpośredniej wiedzy o dostawcach urządzeń. Tabela `residents` nie może posiadać kolumn typu `polar_user_id`. Tego typu relacje muszą zostać umieszczone w osobnej tabeli (zaprojektowano `external_wearable_links`). 

## Cele
1. **INT-CORE-DECOUPLED**: Przetestować i wymusić, by tabela `residents` nie posiadała żadnych obcych atrybutów technicznych.
2. Zapewnić testy integracyjne w `tests/db/`, które:
   - Sprawdzają schemat tabeli `residents` pod kątem kolumn zawierających nazwy dostawców (np. `polar`, `withings`).
   - Gwarantują, że relacja mieszka w tabeli `external_wearable_links`.

## Kryteria Akceptacji
- [ ] Tabela `residents` ma udowodnione braki kolumn dostawców (test z `information_schema.columns`).
- [ ] Zapisanie identyfikatora dostawcy działa na `external_wearable_links`.
