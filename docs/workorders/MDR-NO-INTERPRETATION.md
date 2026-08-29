# Work Order: Zakaz Interpretacji Medycznej (MDR-NO-INTERPRETATION)

## Metadane
- **Wymagania:** `MDR-NO-INTERPRETATION`
- **Domena:** presentation
- **Ryzyko:** HIGH

## Cele
1. Zdefiniować bazowy prompt LLM dla przetwarzania notatek głosowych, który zawiera kategoryczny zakaz diagnozowania i oceniania stanu zdrowia.
2. Napisać test weryfikujący, że prompt zawiera wytyczne blokujące (np. "Do not evaluate health", "Do not diagnose").
