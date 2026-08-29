# Work Order: Ochrona PESEL (SEC-PESEL-HASH)

## Metadane
- **Wymagania:** `SEC-PESEL-HASH`
- **Domena:** security
- **Ryzyko:** HIGH

## Cele
1. Zapewnić brak czystego tekstu PESEL w bazie, przechowując wyłącznie `pesel_hash`.
2. Udowodnić na poziomie testu `information_schema.columns`, że kolumna `pesel` nie występuje.
