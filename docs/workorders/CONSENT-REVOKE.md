# Work Order: Odwołanie Zgody (CONSENT-REVOKE)

## Metadane
- **Wymagania:** `CONSENT-REVOKE`
- **Domena:** consent
- **Ryzyko:** MEDIUM

## Cele
1. Zweryfikować, że cofnięcie zgody nakłada znacznik czasu `revoked_at` zamiast usuwania wiersza.
2. Napisać test weryfikujący procedurę `revoke_consent`.
