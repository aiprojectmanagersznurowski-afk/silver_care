# Work Order: Separacja Danych Medycznych z Głosu (VOICE-MEDICAL-STRIP)

## Metadane
- **Wymagania:** `VOICE-MEDICAL-STRIP`
- **Domena:** voice
- **Ryzyko:** HIGH

## Cele
1. Prompt LLM musi wymuszać, aby ewentualne dane medyczne/kardiologiczne podane przez pielęgniarkę głosowo trafiały wyłącznie do wyizolowanej sekcji ("MEDICAL" / "brudnopis"), a nie do podsumowania dla rodziny.
2. Napisać test weryfikujący, że prompt instruuje model o 3 strumieniach (zgodnie z kontraktem i wymaganiem: MEDICAL, DISCOMFORT, BEHAVIORAL).
