import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const apiKey = process.env.TRELLO_API;
const token = process.env.TRELLO_TOKEN;
const humanListId = '6aa3e25f5830435500ac009c';
const michalId = '6a1e8bee5edd0ea47730152c';
const darekId = '5ce666443ecfaa7f62756e43';
const highLabelId = '6aa2a30b844f5715b408e7a7';

if (!apiKey || !token) {
  console.error('Brak TRELLO_API lub TRELLO_TOKEN w .env.local');
  process.exit(1);
}

const reportPath = '/Users/michalsznurowski/.gemini/antigravity-ide/brain/a3f235d4-bce4-4022-bde1-5848165f7e44/implementation_plan.md';
let rawText = fs.readFileSync(reportPath, 'utf8');

// Formatowanie markdown dla Trello
let desc = rawText
  .replace(/\[`?([^\]`]+)`?\]\(file:\/\/\/[^)]+\)/g, '`$1`')
  .replace(/> \[!CAUTION\]/g, '> 🚨 **ZAGROŻENIE KRYTYCZNE:**')
  .replace(/> \[!WARNING\]/g, '> ⚠️ **OSTRZEŻENIE:**')
  .replace(/> \[!IMPORTANT\]/g, '> 📌 **WAŻNE:**')
  .replace(/> \[!NOTE\]/g, '> ℹ️ **NOTATKA:**');

console.log('Długość opisu w znakach:', desc.length);

async function run() {
  const cardName = '[DO ROZWAŻENIA] Audyt techniczny kodu — 25 ryzyk, architektura, wydajność i skalowalność';

  console.log('Tworzenie karty w Trello...');
  const createRes = await fetch('https://api.trello.com/1/cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: apiKey,
      token: token,
      idList: humanListId,
      name: cardName,
      desc: desc,
      idMembers: [michalId, darekId],
      idLabels: [highLabelId],
      pos: 'top'
    })
  });

  if (!createRes.ok) {
    console.error('Błąd tworzenia karty:', await createRes.text());
    process.exit(1);
  }

  const card = await createRes.json();
  console.log('✅ Karta Trello utworzona pomyślnie!');
  console.log('ID karty:', card.id);
  console.log('URL karty:', card.url || card.shortUrl);

  // Dodanie checklisty z kluczowymi punktami
  console.log('Tworzenie checklisty...');
  const clRes = await fetch(`https://api.trello.com/1/cards/${card.id}/checklists?key=${apiKey}&token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Priorytety napraw — do przedyskutowania' })
  });

  if (clRes.ok) {
    const cl = await clRes.json();
    const items = [
      '🔴 [CRITICAL] 1. Przenieść apps/web/src/proxy.ts -> apps/web/src/middleware.ts (routing protection)',
      '🔴 [CRITICAL] 2. Ograniczyć publiczne API w middleware (usunąć path.startsWith("/api"))',
      '🔴 [HIGH] 3. Zastąpić Math.random() w apps/web/src/actions/iam.ts przez crypto.randomBytes',
      '🔴 [HIGH] 4. Dodać wpis do audit_logs przy deleteResidentAction w actions/admin.ts',
      '🟠 [HIGH] 5. Usunąć ciche placeholder fallbacki w klientach Supabase (rzucać Error)',
      '🟠 [HIGH] 6. Dodać indeksy DB na residents(org_id), bed_assignments, daily_reports, links',
      '🟠 [HIGH] 7. Dodać rate limiting na publicznych endpointach (/api/voice, /api/family)',
      '🟡 [MEDIUM] 8. Zbudować warstwę abstrakcji i wygenerować typy Supabase (Database types)',
      '🟡 [MEDIUM] 9. Dodać paginację do endpointów i widoków tabelarycznych (IAM, Residents)',
      '🟡 [MEDIUM] 10. Zoptymalizować voice pipeline (timeouty, retry, ewentualna asynchroniczność)',
      'ℹ️ [CLEANUP] 11. Usunąć pliki test-invite*.js z katalogu root repozytorium',
      'ℹ️ [CLEANUP] 12. Usunąć zduplikowany apps/web/pnpm-lock.yaml (zostawić tylko w root)'
    ];

    for (const item of items) {
      await fetch(`https://api.trello.com/1/checklists/${cl.id}/checkItems?key=${apiKey}&token=${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: item, pos: 'bottom' })
      });
    }
    console.log(`✅ Dodano ${items.length} pozycji do checklisty!`);
  } else {
    console.warn('Nie udało się utworzyć checklisty:', await clRes.text());
  }

  console.log('\nPodsumowanie:');
  console.log(`- Tytuł: ${card.name}`);
  console.log(`- Lista: HUMAN (${humanListId})`);
  console.log(`- Przypisani: Michał Sznurowski, Darek Rink`);
  console.log(`- Link: ${card.url || card.shortUrl}`);
}

run().catch(console.error);
