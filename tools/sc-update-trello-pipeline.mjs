import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.TRELLO_API;
const token = process.env.TRELLO_TOKEN;
const inReviewListId = '6aa420f641a1300e6a97a10f';

if (!apiKey || !token) {
  console.error('Brak TRELLO_API lub TRELLO_TOKEN w .env.local');
  process.exit(1);
}

const pipelineCards = [
  {
    id: '6aa2a349b465fdac8f260d6a',
    name: 'VOICE-MEDICAL-STRIP',
    comment: [
      '🔄 **Rozpoczęcie realizacji domknięcia pipeline AI (End-to-End)**',
      '',
      '- **REQ-ID**: `VOICE-MEDICAL-STRIP`',
      '- **Zakres**: Pełna integracja etapu REDACT w potoku, import kategorii `MEDICAL_CATEGORIES` z kontraktu, gwarancja że model generujący raport nigdy nie otrzymuje danych medycznych, zapis surowych danych medycznych wyłącznie w brudnopisie personelu.',
      '- **Status**: W trakcie realizacji (Faza implementacji i testów TDD).'
    ].join('\n')
  },
  {
    id: '6aa2a3504bd492c5272d4208',
    name: 'VOICE-ZERO-GUESSING',
    comment: [
      '🔄 **Rozpoczęcie realizacji domknięcia pipeline AI (End-to-End)**',
      '',
      '- **REQ-ID**: `VOICE-ZERO-GUESSING`',
      '- **Zakres**: Wymóg dostarczenia `resident_id` jako UUID z frontendu, zakaz zgadywania i ustalania tożsamości pensjonariusza przez model z transkrypcji, złączenie tożsamości dopiero w pamięci funkcji brzegowej.',
      '- **Status**: W trakcie realizacji (Faza implementacji i testów TDD).'
    ].join('\n')
  },
  {
    id: '6aa2a35ad3bab840cf3a73de',
    name: 'MDR-NO-INTERPRETATION',
    comment: [
      '🔄 **Rozpoczęcie realizacji domknięcia pipeline AI (End-to-End)**',
      '',
      '- **REQ-ID**: `MDR-NO-INTERPRETATION`',
      '- **Zakres**: Wbudowanie guardrails z `MDR_GUARDRAILS.forbiddenStatements`, walidator post-generacyjny `validateReportText()`, dołączenie `AI_DISCLOSURE_LABEL` (EU AI Act) do raportu dla bliskich.',
      '- **Status**: W trakcie realizacji (Faza implementacji i testów TDD).'
    ].join('\n')
  },
  {
    id: '6aa2a3d3aee6a183d7e2d334',
    name: 'INFRA-GROQ-TRANSCRIPTION',
    comment: [
      '🔄 **Rozpoczęcie realizacji domknięcia pipeline AI (End-to-End)**',
      '',
      '- **REQ-ID**: `INFRA-GROQ-TRANSCRIPTION`',
      '- **Zakres**: Weryfikacja bezpieczeństwa `GROQ_API_KEY` (tylko serwer), obsługa limitów zapytań (2000 req/dzień, 8h audio/dzień), oddzielenie providera generowania raportu (EU LLM) od transkrypcji, rejestracja metadanych AI provenance.',
      '- **Status**: W trakcie realizacji (Faza implementacji i testów TDD).'
    ].join('\n')
  }
];

async function run() {
  for (const item of pipelineCards) {
    console.log(`Aktualizacja ${item.name} (${item.id})...`);
    
    // Move to PR Created / In Review
    const moveUrl = `https://api.trello.com/1/cards/${item.id}?idList=${inReviewListId}&key=${apiKey}&token=${token}`;
    const moveRes = await fetch(moveUrl, { method: 'PUT' });
    if (moveRes.ok) {
      console.log(`  ✓ Przeniesiono ${item.name} do listy 'PR Created / In Review'`);
    } else {
      console.error(`  ✗ Błąd przenoszenia ${item.name}:`, await moveRes.text());
    }

    // Add comment
    const commentUrl = `https://api.trello.com/1/cards/${item.id}/actions/comments?text=${encodeURIComponent(item.comment)}&key=${apiKey}&token=${token}`;
    const commentRes = await fetch(commentUrl, { method: 'POST' });
    if (commentRes.ok) {
      console.log(`  ✓ Dodano komentarz do ${item.name}`);
    } else {
      console.error(`  ✗ Błąd dodawania komentarza do ${item.name}:`, await commentRes.text());
    }
  }
  console.log('\nAktualizacja Trello zakończona sukcesem!');
}

run().catch(console.error);
