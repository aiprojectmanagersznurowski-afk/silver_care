# Work Order: Normalizacja Danych (INT-NORMALIZATION)

## Metadane
- **Wymagania:** `INT-NORMALIZATION`
- **Domena:** integration
- **Ryzyko:** LOW

## Kontekst
Dane od dostawców przychodzą w różnych formatach (np. czas snu w ISO 8601 `PT8H30M`, tętno w uderzeniach na minutę). System musi znormalizować te dane przed włożeniem ich do tabeli rdzenia `physiological_data_ingest`.

## Cele
1. Stworzyć nową funkcję `public.normalize_and_ingest(p_org_id, p_resident_id, p_provider, p_metric, p_raw_value, p_dedup_id)` która znormalizuje `p_raw_value` (np. zamieni 'PT8H30M' na 510 minut).
2. Dopisać testy jednostkowe.
