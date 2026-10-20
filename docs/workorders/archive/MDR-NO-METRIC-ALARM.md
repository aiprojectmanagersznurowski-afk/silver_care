# Work Order: Brak Alarmów z Metryk (MDR-NO-METRIC-ALARM)

## Metadane
- **Wymagania:** `MDR-NO-METRIC-ALARM`
- **Domena:** presentation
- **Ryzyko:** MEDIUM

## Cele
1. Napisać asercję (np. `information_schema.triggers`), by zagwarantować, że tabela `physiological_data_ingest` nie posiada żadnych triggerów wysyłających alarmy lub insertujących do `outbox_notifications`. To jest zabezpieczenie przed traktowaniem systemu jako wyrobu medycznego.
