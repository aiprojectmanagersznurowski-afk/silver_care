import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.TRELLO_API;
const token = process.env.TRELLO_TOKEN;
const cardId = '6aa3e27637d58c3f4eddf780'; // API Polar Test
const doneListId = '6aa84adcc231a825604929b5'; // Done

async function run() {
  console.log('Przenoszenie karty API Polar Test do listy Done...');
  
  // 1. Move card to Done
  const moveRes = await fetch(`https://api.trello.com/1/cards/${cardId}?idList=${doneListId}&key=${apiKey}&token=${token}`, {
    method: 'PUT'
  });
  if (!moveRes.ok) {
    const err = await moveRes.text();
    throw new Error('Błąd przenoszenia karty: ' + err);
  }
  console.log('Karta przeniesiona do Done.');

  // 2. Add comment with report
  const commentText = `**[Silver Care Agent - 2026-09-22]**
✅ **Implementacja integracji Polar AccessLink API v3 zakończona sukcesem:**

1. **Wymiana tokena (OAUTH_CONFIG):**
   - Zgodnie z punktem krytycznym z kontraktu i ADR-002, wymiana kodu autoryzacyjnego na token następuje z nagłówkiem \`Authorization: Basic base64(client_id:client_secret)\` na endpoint \`https://polarremote.com/v2/oauth2/token\`.
   - Obsługa rejestracji użytkownika w Polar AccessLink (\`POST /v3/users\`).

2. **Warstwa bazodanowa i bezpieczeństwo (R06-core-decoupled):**
   - Utworzono tabelę \`polar_oauth_tokens\` powiązaną z \`external_wearable_links\`.
   - Tabela \`residents\` pozostała nienaruszona (brak kolumn zewnętrznych dostawców).
   - Dostęp do tokenów zabezpieczony rygorystycznym RLS (tylko \`org_admin\` i \`super_admin\`, brak dostępu dla personelu i rodziny).

3. **MDR Deny-by-default & Normalizacja (INT-NORMALIZATION, INT-INGEST-PRECONDITIONS):**
   - Pobieranie i normalizacja dobowych kroków (\`steps_total\`), czasu aktywności (ISO-8601 \`PT...\` zamieniane na minuty), kalorii oraz czasu snu (\`sleep_start_time\`, \`sleep_end_time\`, \`sleep_duration_min\`).
   - Wszelkie zabronione przez MDR dane kliniczne (częstość oddechów, wykresy faz snu, zapis ciągły tętna) są bezwzględnie odrzucane.
   - Zasilenie dedykowanej procedury bazodanowej \`process_ingest_batch\` z weryfikacją zgód w \`consent_ledger\`.

4. **Trasy API i Interfejs Użytkownika:**
   - \`/api/polar/auth\` — inicjowanie OAuth2 i przekierowanie do Polar Flow.
   - \`/api/polar/callback\` — odbiór kodu, rejestracja usera i sparowanie w bazie.
   - \`/api/polar/sync\` — synchronizacja danych na żądanie.
   - \`/api/polar/webhook\` — nasłuchiwanie powiadomień ping z chmury Polar.
   - Komponent \`PolarWearableCard\` w widoku profilu pensjonariusza (\`/admin/residents/[id]\`).

5. **Weryfikacja jakościowa:**
   - 75 plików testowych, 181 testów jednostkowych i integracyjnych — 100% PASS.
   - Pełna bramka \`verify.sh --full\` ZIELONA (6/6).
   - Build produkcyjny Next.js przeszedł pomyślnie.`;

  const commentRes = await fetch(`https://api.trello.com/1/cards/${cardId}/actions/comments?key=${apiKey}&token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: commentText })
  });

  if (!commentRes.ok) {
    console.error('Błąd dodawania komentarza:', await commentRes.text());
  } else {
    console.log('Komentarz z raportem pomyślnie dodany do karty Trello.');
  }
}

run().catch(console.error);
