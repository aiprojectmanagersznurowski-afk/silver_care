# Work Order: Reżim Ekstrakcji Głosu (VOICE-ZERO-GUESSING)

## Metadane
- **Wymagania:** `VOICE-ZERO-GUESSING`
- **Domena:** voice
- **Ryzyko:** MEDIUM

## Cele
1. Prompt LLM przetwarzający notatki głosowe personelu musi działać wyłącznie w trybie ekstrakcji faktów z nagrania (zero wymyślania).
2. Napisać test weryfikujący instrukcje (np. "Extract facts only", "Do not guess").
