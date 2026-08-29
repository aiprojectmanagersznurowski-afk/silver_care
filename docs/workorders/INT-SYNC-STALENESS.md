# Work Order: Detekcja braku synchronizacji (INT-SYNC-STALENESS)

## Metadane
- **Wymagania:** `INT-SYNC-STALENESS`
- **Domena:** integration
- **Ryzyko:** LOW

## Cele
1. Utworzyć widok `public.resident_sync_status`, który zwraca dla każdego aktywnego mieszkańca:
   - Czas od ostatniego pingu z jakiegokolwiek urządzenia
   - Status (np. `ACTIVE`, `STALE`, `OFFLINE`) na podstawie progu (np. 12 godzin to `STALE`, 24 godziny to `OFFLINE`).
2. Dodać testy sprawdzające.
