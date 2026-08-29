# Work Order: Bezpieczne Powiadomienia (NTF-NO-PII)

## Metadane
- **Wymagania:** `NTF-NO-PII`
- **Domena:** notifications
- **Ryzyko:** HIGH

## Cele
1. Upewnić się, że struktura `outbox_notifications` lub trigger nie umieszcza PII pacjenta w tekście powiadomienia (jedynie `report_id` lub standardowy komunikat "Nowy raport jest gotowy").
2. Udowodnić to testem jednostkowym bazy danych, weryfikując wygenerowany wpis.
