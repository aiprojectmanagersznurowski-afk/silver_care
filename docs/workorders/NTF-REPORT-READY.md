# Work Order: Powiadomienie o Raporcie (NTF-REPORT-READY)

## Metadane
- **Wymagania:** `NTF-REPORT-READY`
- **Domena:** notifications
- **Ryzyko:** LOW

## Cele
1. Utworzyć tabelę `outbox_notifications` zbierającą powiadomienia do wysyłki.
2. Utworzyć trigger na `daily_reports`, który przy zmianie statusu na `PUBLISHED` wkłada nowy rekord do `outbox_notifications`.
