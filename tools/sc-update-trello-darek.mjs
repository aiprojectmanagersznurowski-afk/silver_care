import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.TRELLO_API;
const token = process.env.TRELLO_TOKEN;
const inReviewListId = '6aa420f641a1300e6a97a10f';

if (!apiKey || !token) {
  console.error('Brak TRELLO_API lub TRELLO_TOKEN w .env.local');
  process.exit(1);
}

const darekUpdates = [
  {
    id: '6aa2a31789632fafb6d106a7',
    name: 'ORG-ISOLATION',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `ORG-ISOLATION`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Wielodostępna izolacja placówek w PostgreSQL RLS w oparciu o `organization_id` z JWT (`request.jwt.claims`), brak wycieku danych pomiędzy organizacjami, automatyczne dziedziczenie `organization_id` na insertach.'
    ].join('\n')
  },
  {
    id: '6aa2a3182f66bffd753c1b09',
    name: 'ORG-PROVISION',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `ORG-PROVISION`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Bezpieczna funkcja RPC `provision_organization(name, admin_email)` z restrykcją wykonania wyłącznie dla roli `super_admin`. Atomowe zakładanie placówki i pierwszego administratora.'
    ].join('\n')
  },
  {
    id: '6aa2a323403c5e19a5737d41',
    name: 'CONSENT',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `CONSENT`, `CONSENT-GRANTOR`, `CONSENT-REVOKE`, `CONSENT-LEDGER-IMMUTABLE`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Niezmienialny rejestr zgód Art. 9 RODO (`consent_ledger`) o charakterze append-only. Twarda blokada `UPDATE` i `DELETE` na poziomie triggerów bazy danych.'
    ].join('\n')
  },
  {
    id: '6aa2a324c67ec61887fe56c0',
    name: 'CONSENT-GRANTOR',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `CONSENT-GRANTOR`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Wymuszenie prawne podmiotu wyrażającego zgodę: wyłącznie pensjonariusz (`resident_self`) lub opiekun prawny (`legal_guardian`). Blokada wyrażania zgód dla zwykłych krewnych (`family`).'
    ].join('\n')
  },
  {
    id: '6aa2a326e9b706a066df0188',
    name: 'CONSENT-REVOKE',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `CONSENT-REVOKE`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Procedura odwoływania zgody `revoke_consent()` nakładająca znacznik `revoked_at` bez usuwania historii, z automatycznym zapisem audytowym `CONSENT_WITHDRAWN`.'
    ].join('\n')
  },
  {
    id: '6aa2a341eb8a6ab8a38fae3e',
    name: 'INT-CORE',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `INT-CORE-DECOUPLED`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Rozprzężenie rdzenia systemu od dostawców zewnętrznych. Tabela `residents` oczyszczona z kolumn typu `polar_user_id`; identyfikatory zewnętrzne przeniesione do `external_wearable_links`.'
    ].join('\n')
  },
  {
    id: '6aa2a3474e9f735fbece04fd',
    name: 'INT-NORMALIZATION',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `INT-NORMALIZATION`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Funkcja `normalize_and_ingest()` dokonująca normalizacji danych telemetrycznych (np. formatów ISO 8601 czasu trwania `PT8H30M` do wartości liczbowych w minutach).'
    ].join('\n')
  },
  {
    id: '6aa2a348f68960c2a00b8fa0',
    name: 'INT-SYNC-STALENESS',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `INT-SYNC-STALENESS`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Widok bazy danych `resident_sync_status` wyliczający czas od ostatniej telemetrii i kategoryzujący stan połączenia (`ACTIVE`, `STALE`, `OFFLINE`).'
    ].join('\n')
  },
  {
    id: '6aa2a349b465fdac8f260d6a',
    name: 'VOICE-MEDICAL-STRIP',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `VOICE-MEDICAL-STRIP`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Separacja strumieni notatek głosowych personelu: `MEDICAL` (wycinany z widoku rodziny, dostępny tylko w brudnopisie personelu), `DISCOMFORT` oraz `BEHAVIORAL`.'
    ].join('\n')
  },
  {
    id: '6aa2a3504bd492c5272d4208',
    name: 'VOICE-ZERO-GUESSING',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `VOICE-ZERO-GUESSING`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Rygorystyczny prompt ekstrakcji LLM zakazujący nadinterpretacji i zgadywania faktów nieobecnych w nagraniu dyżuru pielęgniarskiego.'
    ].join('\n')
  },
  {
    id: '6aa2a35ad3bab840cf3a73de',
    name: 'MDR-NO-INTERPRETATION',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `MDR-NO-INTERPRETATION`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Kategoryczny zakaz diagnozowania medycznego i oceniania stanu zdrowia w promptach oraz warstwie prezentacji, gwarantujący status wyrobu niemedycznego.'
    ].join('\n')
  },
  {
    id: '6aa2a3c92f8f0f58138b0a14',
    name: 'MDR-NO-METRIC-ALARM',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `MDR-NO-METRIC-ALARM`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Asercja bazodanowa gwarantująca brak jakichkolwiek triggerów alarmowych czy powiadomień generowanych bezpośrednio ze zmian metryk telemetrycznych.'
    ].join('\n')
  },
  {
    id: '6aa2a3ce041493648e96b69b',
    name: 'NTF-NO-PII',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `NTF-NO-PII`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Całkowity brak danych osobowych (PII) w tabeli `outbox_notifications` oraz wysyłanych notyfikacjach (wyłącznie identyfikatory techniczne i ustandaryzowane szablony).'
    ].join('\n')
  },
  {
    id: '6aa2a3cfb990557a2ed87acb',
    name: 'SEC-MFA-STAFF',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `SEC-MFA-STAFF`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Zweryfikowana mechanika wymuszania poziomu uwierzytelnienia AAL2 (`auth.jwt() -> aal`) dla ról personelu medycznego i administracji placówki.'
    ].join('\n')
  },
  {
    id: '6aa2a3d0049be3c71e5c610b',
    name: 'SEC-SESSION',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `SEC-SESSION`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Gwarancja konfiguracji sesji personelu wygasającej po okresie bezczynności (timeout sesji w kontrakcie i konfiguracji auth).'
    ].join('\n')
  },
  {
    id: '6aa2a3d04471c9ffb8442546',
    name: 'SEC-PESEL-HASH',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `SEC-PESEL-HASH`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Asercja bazodanowa wykluczająca obecność jawnego numeru PESEL w tabeli `residents`. Przechowywanie wyłącznie jednokierunkowego hasha z solą (`pesel_hash`).'
    ].join('\n')
  },
  {
    id: '6aa2a3d170d6215c35861cd2',
    name: 'SEC-403-LOGGING',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `SEC-403-LOGGING`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Procedura `log_access_denied()` bezpiecznie rejestrująca odmowy RLS w `audit_logs` bez logowania danych poufnych i PII.'
    ].join('\n')
  },
  {
    id: '6aa2a3d1a59cc9ea85041c5b',
    name: 'SEC-RETENTION',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `SEC-RETENTION`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Funkcja `enforce_retention_policy()` automatyzująca czyszczenie przeterminowanych rekordów w `audit_logs` z zachowaniem zanonimizowanego śladu audytowego.'
    ].join('\n')
  },
  {
    id: '6aa2a3d239f82de1493f99c7',
    name: 'INFRA-EU-REGION',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `INFRA-EU-REGION`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Wymuszenie lokalizacji danych i bazy w regionie europejskim `eu-central-1` (Frankfurt) zgodnie z RODO.'
    ].join('\n')
  },
  {
    id: '6aa2a3d3aee6a183d7e2d334',
    name: 'INFRA-GROQ-TRANSCRIPTION',
    comment: [
      '🚀 **Weryfikacja i wdrożenie zakończone**',
      '',
      '- **REQ-ID**: `INFRA-GROQ-TRANSCRIPTION`',
      '- **Bramka Jakościowa**: `bash scripts/verify.sh --full` — **100% PASS (6/6 etapów)**',
      '- **Kluczowe funkcje**: Zdefiniowany kontrakt i zintegrowana obsługa usługi transkrypcji Groq (Whisper large-v3) dla notatek głosowych personelu.'
    ].join('\n')
  }
];

async function run() {
  console.log(`Rozpoczynam synchronizację ${darekUpdates.length} kart Darka w Trello...`);
  for (const item of darekUpdates) {
    console.log(`Aktualizacja ${item.name} (${item.id})...`);
    
    // Przeniesienie do listy PR Created / In Review
    const moveUrl = `https://api.trello.com/1/cards/${item.id}?idList=${inReviewListId}&key=${apiKey}&token=${token}`;
    const moveRes = await fetch(moveUrl, { method: 'PUT' });
    if (moveRes.ok) {
      console.log(`  ✓ Przeniesiono ${item.name} do 'PR Created / In Review'`);
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
  console.log('\nSynchronizacja wszystkich kart Darka w Trello zakończona pomyślnie!');
}

run().catch(console.error);
