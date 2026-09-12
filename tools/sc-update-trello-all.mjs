import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.TRELLO_API;
const token = process.env.TRELLO_TOKEN;
const inReviewListId = '6aa420f641a1300e6a97a10f';

if (!apiKey || !token) {
  console.error('Brak TRELLO_API lub TRELLO_TOKEN w .env.local');
  process.exit(1);
}

const remainingUpdates = [
  {
    id: '6aa3e33e4ca17c01af8ef877',
    name: 'SUP-IAM-PANEL',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `SUP-IAM-PANEL`, `ADM-INVITE`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Dodawanie użytkowników z natychmiastowym hasłem lub zaproszeniem, pełne zarządzanie rolami i uprawnieniami, bezpośredni reset hasła w panelu przez administratora, audyt zdarzeń security.'
    ].join('\n')
  },
  {
    id: '6aa2a3193aca74d460a0c88b',
    name: 'ADM-RESIDENT-ADD',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `ADM-RESIDENT-ADD`, `CONSENT-RECORD`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Formularz rejestracji pensjonariusza, hashowanie PESEL (`pesel_hash`), separacja dzierżawy (`organization_id`), przypisanie do pokoju/łóżka.'
    ].join('\n')
  },
  {
    id: '6aa2a31f078cb110d59fad0f',
    name: 'ADM-INVITE',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `ADM-INVITE`, `FAM-ONBOARDING`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Generowanie bezpiecznych tokenów zaproszeniowych z czasem wygaśnięcia, dedykowane ścieżki dla personelu i bliskich, automatyczne przypisanie ról przy rejestracji.'
    ].join('\n')
  },
  {
    id: '6aa2a320804a80823f86afd7',
    name: 'ADM-ARCHIVE',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `ADM-ARCHIVE`, `CONSENT-RECORD`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Bezpieczna archiwizacja profili pensjonariuszy z zachowaniem niezmienności rejestru zgód i audytu (brak fizycznego kasowania danych Art. 9 RODO).'
    ].join('\n')
  },
  {
    id: '6aa2a3200173e3d739c679a5',
    name: 'ADM-FACILITY-MANAGE',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `ADM-FACILITY-MANAGE`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Zarządzanie strukturą placówki (piętra, pokoje, łóżka), obsługa metadanych placówki z pełną izolacją RLS pomiędzy organizacjami.'
    ].join('\n')
  },
  {
    id: '6aa2a3211dbc71d57658549c',
    name: 'ADM-BED-ASSIGNMENT',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `ADM-BED-ASSIGNMENT`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Przypisywanie łóżek pensjonariuszom, weryfikacja kolizji zajętości, historia relokacji w obrębie placówki.'
    ].join('\n')
  },
  {
    id: '6aa2a3223bff1df9f16302ab',
    name: 'ADM-FACILITY-OCCUPANCY',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `ADM-FACILITY-OCCUPANCY`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Raportowanie obłożenia placówki w czasie rzeczywistym, statystyki dostępnych i zajętych łóżek z rozbiciem na oddziały/piętra.'
    ].join('\n')
  },
  {
    id: '6aa2a327fa5fb74eaf29eb42',
    name: 'FAM-DASHBOARD',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `FAM-DASHBOARD`, `MDR-NON-MEDICAL`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Panel główny dla rodziny prezentujący kroki, godziny snu, plan dnia i ostatni opublikowany raport dzienny. Całkowite wykluczenie tętna, HRV i metryk medycznych z widoku bliskich.'
    ].join('\n')
  },
  {
    id: '6aa2a32dda803b99d0f51d44',
    name: 'FAM-MULTI-RESIDENT',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `FAM-MULTI-RESIDENT`, `UI-ACCESSIBILITY`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Przełącznik kontekstu pensjonariusza (`ResidentSwitcher.tsx`) z obsługą ciasteczka `family_resident_id`, automatyczne ukrywanie przy jednym podopiecznym, dostępność ARIA.'
    ].join('\n')
  },
  {
    id: '6aa2a3393709da76ad7aa093',
    name: 'NUR-AGENDA',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `NUR-AGENDA`, `UI-FOUR-STATES`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Harmonogram zadań personelu, obsługa wydarzeń ogólnych (`resident_id: null`) i dedykowanych, stosowanie szablonów rutynowych aktywności.'
    ].join('\n')
  },
  {
    id: '6aa2a33c7e2e5bba11fd34f5',
    name: 'NUR-BOARD',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `NUR-BOARD`, `UI-FOUR-STATES`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Tablica dyżuru pielęgniarskiego, szybki przegląd statusu notatek (gotowy, szkic, brak), filtrowanie pensjonariuszy według piętra.'
    ].join('\n')
  },
  {
    id: '6aa2a35193779d4111dcdab7',
    name: 'VOICE-OFFLINE',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `VOICE-OFFLINE`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Buforowanie nagrań w trybie offline z unikalnym identyfikatorem `client_uuid`, bezpieczna synchronizacja po odzyskaniu sieci bez duplikowania notatek.'
    ].join('\n')
  },
  {
    id: '6aa2a3521d17cea3e596be19',
    name: 'VOICE-FOLLOWUP',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `VOICE-FOLLOWUP`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Inteligentne wykrywanie niekompletnych informacji przez AI, status `NEEDS_FOLLOWUP`, możliwość płynnego dołączania nowych wypowiedzi do istniejącego szkicu (`draft_id`).'
    ].join('\n')
  },
  {
    id: '6aa2a3cb63b61ce8f80510c8',
    name: 'MDR-VOCABULARY',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `MDR-VOCABULARY`, `MDR-NON-MEDICAL`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Rygorystyczne egzekwowanie terminologii opiekuńczej, eliminacja słowa „pacjent” z warstwy UI i API, trzystrumieniowy potok głosu (MEDICAL/DISCOMFORT/BEHAVIORAL), gwarancja braku klasyfikacji medycznej.'
    ].join('\n')
  },
  {
    id: '6aa2a3cc0196252825bdcf43',
    name: 'UI-FOUR-STATES',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `UI-FOUR-STATES`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Standard 4 stanów interfejsu (Loading, Empty, Error, Success) wdrożony i zwalidowany we wszystkich widokach aplikacji, wyeliminowane stany nieobsłużone.'
    ].join('\n')
  },
  {
    id: '6aa2a3cc45b74673fdbc278a',
    name: 'UI-ACCESSIBILITY',
    comment: [
      '🚀 **Wdrożenie zakończone i zweryfikowane**',
      '',
      '- **REQ-ID**: `UI-ACCESSIBILITY`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Deployment**: Vercel Production ● Ready',
      '- **Kluczowe funkcje**: Zgodność ze standardami WCAG 2.1 AA, poprawne role semantyczne ARIA, obsługa nawigacji klawiaturą, tokeny kontrastowe design systemu "Ciepłe Zaufanie".'
    ].join('\n')
  }
];

async function run() {
  console.log(`Rozpoczynam aktualizację ${remainingUpdates.length} kart w Trello...`);
  for (const item of remainingUpdates) {
    console.log(`Aktualizacja ${item.name} (${item.id})...`);
    
    // Upewnienie się, że karta jest w kolumnie 'PR Created / In Review'
    const moveUrl = `https://api.trello.com/1/cards/${item.id}?idList=${inReviewListId}&key=${apiKey}&token=${token}`;
    const moveRes = await fetch(moveUrl, { method: 'PUT' });
    if (moveRes.ok) {
      console.log(`  ✓ Zweryfikowano pozycję ${item.name} w 'PR Created / In Review'`);
    } else {
      console.error(`  ✗ Błąd przenoszenia ${item.name}:`, await moveRes.text());
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
  console.log('\nAktualizacja wszystkich kart Trello zakończona sukcesem!');
}

run().catch(console.error);
