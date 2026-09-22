import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.TRELLO_API;
const token = process.env.TRELLO_TOKEN;
const doneListId = '6aa84adcc231a825604929b5';

if (!apiKey || !token) {
  console.error('Brak TRELLO_API lub TRELLO_TOKEN w .env.local');
  process.exit(1);
}

const completedUpdates = [
  {
    id: '6aa2a349b465fdac8f260d6a',
    name: 'VOICE-MEDICAL-STRIP',
    comment: [
      '🚀 **Weryfikacja i domknięcie pipeline AI zakończone sukcesem**',
      '',
      '- **REQ-ID**: `VOICE-MEDICAL-STRIP`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Commity**: `7253244` (test: RED), `159f42e` (feat: GREEN), `9365fce` (docs: done)',
      '- **Kluczowe wdrożenia**: Jawna separacja 3 strumieni (`MEDICAL`, `DISCOMFORT`, `BEHAVIORAL`), import `MEDICAL_CATEGORIES` w promptach, moduł walidacyjny `validateNoMedicalDataInReport()`, izolacja danych medycznych wyłącznie do `daily_logs` personelu.'
    ].join('\n')
  },
  {
    id: '6aa2a3504bd492c5272d4208',
    name: 'VOICE-ZERO-GUESSING',
    comment: [
      '🚀 **Weryfikacja i domknięcie pipeline AI zakończone sukcesem**',
      '',
      '- **REQ-ID**: `VOICE-ZERO-GUESSING`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Commity**: `7253244` (test: RED), `159f42e` (feat: GREEN), `9365fce` (docs: done)',
      '- **Kluczowe wdrożenia**: Wymóg `resident_id` jako UUID z frontendu, twarda dyrektywa `ZERO_GUESSING_DIRECTIVE`, zakaz odgadywania tożsamości z transkrypcji przez model, łączenie tożsamości dopiero w pamięci funkcji brzegowej przed zapisem raportu.'
    ].join('\n')
  },
  {
    id: '6aa2a35ad3bab840cf3a73de',
    name: 'MDR-NO-INTERPRETATION',
    comment: [
      '🚀 **Weryfikacja i domknięcie pipeline AI zakończone sukcesem**',
      '',
      '- **REQ-ID**: `MDR-NO-INTERPRETATION`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Commity**: `7253244` (test: RED), `159f42e` (feat: GREEN), `9365fce` (docs: done)',
      '- **Kluczowe wdrożenia**: Guardrail post-generacyjny `validateReportText()` odrzucający sformułowania kliniczne i słownictwo medyczne, zakaz oceny stanu zdrowia i diagnoz, automatyczne dołączanie etykiety EU AI Act (`AI_DISCLOSURE_LABEL`) do raportów dla bliskich.'
    ].join('\n')
  },
  {
    id: '6aa2a3d3aee6a183d7e2d334',
    name: 'INFRA-GROQ-TRANSCRIPTION',
    comment: [
      '🚀 **Weryfikacja i domknięcie pipeline AI zakończone sukcesem**',
      '',
      '- **REQ-ID**: `INFRA-GROQ-TRANSCRIPTION`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Commity**: `7253244` (test: RED), `159f42e` (feat: GREEN), `9365fce` (docs: done)',
      '- **Kluczowe wdrożenia**: Weryfikacja serwerowego odizolowania `GROQ_API_KEY`, rejestracja metadanych AI provenance (`ai_model`, `ai_prompt_version`, `ai_generated_at`, `approved_at`) w schemacie `daily_reports`, obsługa konfigurowalnego modelu EU dla generatora raportów (`REPORT_LLM_MODEL`).'
    ].join('\n')
  }
];

async function run() {
  for (const item of completedUpdates) {
    console.log(`Aktualizacja ${item.name} (${item.id})...`);
    
    // Przeniesienie do Done
    const moveUrl = `https://api.trello.com/1/cards/${item.id}?idList=${doneListId}&key=${apiKey}&token=${token}`;
    const moveRes = await fetch(moveUrl, { method: 'PUT' });
    if (moveRes.ok) {
      console.log(`  ✓ Przeniesiono ${item.name} do listy 'Done'`);
    } else {
      console.error(`  ✗ Błąd przenoszenia ${item.name}:`, await moveRes.text());
    }

    // Dodanie komentarza ze szczegółami wdrożenia
    const commentUrl = `https://api.trello.com/1/cards/${item.id}/actions/comments?text=${encodeURIComponent(item.comment)}&key=${apiKey}&token=${token}`;
    const commentRes = await fetch(commentUrl, { method: 'POST' });
    if (commentRes.ok) {
      console.log(`  ✓ Dodano komentarz ze statusem do ${item.name}`);
    } else {
      console.error(`  ✗ Błąd dodawania komentarza do ${item.name}:`, await commentRes.text());
    }
  }
  console.log('\nAktualizacja Trello zakończona sukcesem!');
}

run().catch(console.error);
