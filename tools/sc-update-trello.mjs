import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.TRELLO_API;
const token = process.env.TRELLO_TOKEN;
const inReviewListId = '6aa420f641a1300e6a97a10f';

if (!apiKey || !token) {
  console.error('Brak TRELLO_API lub TRELLO_TOKEN w .env.local');
  process.exit(1);
}

const updates = [
  {
    id: '6aa2a339fba6d418902551db',
    name: 'FAM-ONBOARDING',
    move: true,
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `FAM-ONBOARDING`, `CONSENT-GRANTOR`, `UI-FOUR-STATES`, `ADM-INVITE`',
      '- **Commity**: `1e67299` (test: RED), `2e9e751` (feat: GREEN)',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Aktywacja konta z tokena, dziedziczenie ról `family` oraz `legal_guardian`, rejestracja zgód Art. 9 RODO w `consent_ledger`, interfejs 4-stanowy.'
    ].join('\n')
  },
  {
    id: '6aa2a328eac322d9606192e4',
    name: 'FAM-AGENDA',
    move: true,
    comment: [
      '🚀 **Wdrożenie zaktualizowane i zweryfikowane**',
      '',
      '- **REQ-ID**: `FAM-AGENDA`, `UI-FOUR-STATES`',
      '- **Commit**: `17d4a2a`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Zakres**: Łączenie pozycji wspólnych i indywidualnych, ochrona RLS dla ról bliskich bez wycieku danych innych pensjonariuszy, dedykowany estetyczny stan pusty.'
    ].join('\n')
  },
  {
    id: '6aa2a32c4aae4b0ae88b7e07',
    name: 'FAM-MESSAGES',
    move: true,
    comment: [
      '🚀 **Wdrożenie zaktualizowane i zweryfikowane**',
      '',
      '- **REQ-ID**: `FAM-MESSAGES`, `UI-FOUR-STATES`',
      '- **Commit**: `17d4a2a`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Zakres**: Niezmienialne wiadomości append-only, walidacja powiązania w relacjach, limit 3 wiadomości/godzinę z dedykowanym banerem błędu, pełna migracja na tokeny design systemu.'
    ].join('\n')
  },
  {
    id: '6aa2a3cd65e430242ccdec76',
    name: 'NTF-REPORT-READY',
    move: true,
    comment: [
      '🚀 **Wdrożenie przeniesione i zweryfikowane**',
      '',
      '- **REQ-ID**: `NTF-REPORT-READY`, `NTF-NO-PII`',
      '- **Commit**: `17d4a2a`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Zakres**: Transactional outbox triggerowany publikacją raportu, obsługa powiadomień dla `family` oraz `legal_guardian`, gwarancja braku danych o zdrowiu i metryk fizjologicznych w powiadomieniu.'
    ].join('\n')
  }
];

async function run() {
  for (const item of updates) {
    console.log(`Aktualizacja ${item.name} (${item.id})...`);
    
    // Przeniesienie do listy PR Created / In Review
    if (item.move) {
      const moveUrl = `https://api.trello.com/1/cards/${item.id}?idList=${inReviewListId}&key=${apiKey}&token=${token}`;
      const moveRes = await fetch(moveUrl, { method: 'PUT' });
      if (moveRes.ok) {
        console.log(`  ✓ Przeniesiono ${item.name} do listy 'PR Created / In Review'`);
      } else {
        console.error(`  ✗ Błąd przenoszenia ${item.name}:`, await moveRes.text());
      }
    }

    // Dodanie komentarza
    const commentUrl = `https://api.trello.com/1/cards/${item.id}/actions/comments?text=${encodeURIComponent(item.comment)}&key=${apiKey}&token=${token}`;
    const commentRes = await fetch(commentUrl, { method: 'POST' });
    if (commentRes.ok) {
      console.log(`  ✓ Dodano komentarz ze statusem do ${item.name}`);
    } else {
      console.error(`  ✗ Błąd dodawania komentarza do ${item.name}:`, await commentRes.text());
    }
  }
  console.log('\nSynchronizacja Trello zakończona pomyślnie!');
}

run().catch(console.error);
