import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL is required in .env.local');
}

const sql = postgres(dbUrl, { prepare: false });

async function seedMessagesAndReports() {
  console.log('--- Rozpoczynam seedowanie danych demonstracyjnych wiadomości i raportów ---');

  // 1. Pobierz organizację
  const orgs = await sql`SELECT id, name FROM public.organizations LIMIT 1`;
  if (orgs.length === 0) {
    throw new Error('Brak organizacji w bazie danych.');
  }
  const orgId = orgs[0].id;
  console.log(`Organizacja: ${orgs[0].name} (${orgId})`);

  // 2. Pobierz użytkownika rodziny (e2e.family)
  const familyUsers = await sql`
    SELECT id, email FROM auth.users
    WHERE raw_app_meta_data->>'role' = 'family'
    LIMIT 1
  `;
  if (familyUsers.length === 0) {
    throw new Error('Brak konta rodzinnego w auth.users.');
  }
  const familyUser = familyUsers[0];
  console.log(`Konto rodziny: ${familyUser.email} (${familyUser.id})`);

  // 3. Pobierz użytkownika personelu (nurse)
  const nurseUsers = await sql`
    SELECT id, email FROM auth.users
    WHERE raw_app_meta_data->>'role' = 'nurse'
    LIMIT 1
  `;
  const nurseUser = nurseUsers[0] || null;
  console.log(`Konto personelu: ${nurseUser?.email || 'brak'} (${nurseUser?.id || '-'})`);

  // 4. Pobierz podopiecznych powiązanych z rodziną
  const linkedResidents = await sql`
    SELECT r.id, r.first_name, r.last_name
    FROM public.resident_relative_links rrl
    JOIN public.residents r ON r.id = rrl.resident_id
    WHERE rrl.relative_user_id = ${familyUser.id} AND r.archived_at IS NULL
    ORDER BY r.last_name ASC
  `;

  if (linkedResidents.length < 4) {
    throw new Error(`Wymaganych co najmniej 4 powiązanych pensjonariuszy, znaleziono: ${linkedResidents.length}`);
  }

  const [res1, res2, res3, res4] = linkedResidents;
  console.log(`Wybrani pensjonariusze do wątków:`);
  console.log(`  1. ${res1.first_name} ${res1.last_name} (${res1.id}) - oczekujący na odpowiedź`);
  console.log(`  2. ${res2.first_name} ${res2.last_name} (${res2.id}) - nowa wiadomość od rodziny po odpowiedzi personelu`);
  console.log(`  3. ${res3.first_name} ${res3.last_name} (${res3.id}) - wątek obsłużony (ostatnia wiadomość personelu)`);
  console.log(`  4. ${res4.first_name} ${res4.last_name} (${res4.id}) - 2 oczekujące pytania od rodziny`);

  // 5. Wyczyść stare wiadomości demo dla tych podopiecznych (aby można było uruchamiać wielokrotnie)
  await sql`
    DELETE FROM public.family_messages
    WHERE resident_id IN (${res1.id}, ${res2.id}, ${res3.id}, ${res4.id})
  `;
  console.log('Wyczyszczono poprzednie wiadomości dla wybranych podopiecznych.');

  const now = Date.now();
  const hoursAgo = (h) => new Date(now - h * 3600 * 1000).toISOString();

  // 6. Wstaw realistyczne konwersacje
  // Wątek 1: Stanisław Wiśniewski (lub pierwszy) - oczekujący
  await sql`
    INSERT INTO public.family_messages (organization_id, resident_id, relative_user_id, content, is_from_family, created_at)
    VALUES (
      ${orgId},
      ${res1.id},
      ${familyUser.id},
      'Dzień dobry, czy tata dobrze się dzisiaj czuł podczas popołudniowego spaceru w ogrodzie? Czy dopisywał mu apetyt?',
      true,
      ${hoursAgo(2)}
    )
  `;

  // Wątek 2: Helena Dąbrowska (lub drugi) - nowa wiadomość po odpowiedzi personelu
  await sql`
    INSERT INTO public.family_messages (organization_id, resident_id, relative_user_id, content, is_from_family, staff_user_id, created_at)
    VALUES 
      (
        ${orgId},
        ${res2.id},
        ${familyUser.id},
        'Dzień dobry, przywiozłam dzisiaj dla mamy dodatkowy ciepły koc i kapcie. Zostawiłam w dyżurce na parterze.',
        true,
        NULL,
        ${hoursAgo(8)}
      ),
      (
        ${orgId},
        ${res2.id},
        ${familyUser.id},
        'Dzień dobry! Dziękujemy bardzo, odebraliśmy pakunek i przekazaliśmy pani Helenie do pokoju. Bardzo się ucieszyła.',
        false,
        ${nurseUser?.id || null},
        ${hoursAgo(4)}
      ),
      (
        ${orgId},
        ${res2.id},
        ${familyUser.id},
        'Wspaniale, dziękuję serdecznie za informację i opiekę! Życzę spokojnego dyżuru.',
        true,
        NULL,
        ${hoursAgo(1)}
      )
  `;

  // Wątek 3: Kazimierz Wójcik (lub trzeci) - obsłużony (ostatnia wiadomość od personelu)
  await sql`
    INSERT INTO public.family_messages (organization_id, resident_id, relative_user_id, content, is_from_family, staff_user_id, created_at)
    VALUES 
      (
        ${orgId},
        ${res3.id},
        ${familyUser.id},
        'Dzień dobry, czy pan Kazimierz chętnie uczestniczył w dzisiejszych zajęciach plastycznych?',
        true,
        NULL,
        ${hoursAgo(12)}
      ),
      (
        ${orgId},
        ${res3.id},
        ${familyUser.id},
        'Dzień dobry! Tak, pan Kazimierz spędził bardzo miłe przedpołudnie w świetlicy, namalował piękny pejzaż jesienny i chętnie rozmawiał z sąsiadami.',
        false,
        ${nurseUser?.id || null},
        ${hoursAgo(3)}
      )
  `;

  // Wątek 4: Teresa Kozłowska (lub czwarty) - 2 oczekujące wiadomości
  await sql`
    INSERT INTO public.family_messages (organization_id, resident_id, relative_user_id, content, is_from_family, created_at)
    VALUES 
      (
        ${orgId},
        ${res4.id},
        ${familyUser.id},
        'Dzień dobry, czy mama zjadła dzisiejszy obiad z apetytem?',
        true,
        ${hoursAgo(5)}
      ),
      (
        ${orgId},
        ${res4.id},
        ${familyUser.id},
        'I czy możemy z bratem odwiedzić mamę jutro około godziny 16:00?',
        true,
        ${hoursAgo(2.5)}
      )
  `;

  console.log('✅ Zapisano 7 demonstracyjnych wiadomości w 4 wątkach.');

  // 7. Sprawdź i dodaj 2 demonstracyjne raporty dobowe (daily_reports), jeśli tabela jest pusta
  const reportCount = await sql`SELECT count(*) FROM public.daily_reports`;
  if (parseInt(reportCount[0].count, 10) === 0) {
    console.log('Tabela daily_reports jest pusta. Dodaję 2 przykładowe zatwierdzone raporty...');
    const reportContent1 = JSON.stringify({
      text: 'Spokojny, dobry dzień w placówce. Pensjonariusz uczestniczył w spacerze w ogrodzie, posiłki zjedzone ze smakiem, dobre samopoczucie podopiecznego.',
      metrics: {
        steps: 3420,
        sleep_hours: 7.8
      }
    });

    const reportContent2 = JSON.stringify({
      text: 'Aktywne przedpołudnie w świetlicy, udział w zajęciach plastycznych. Popołudniowy odpoczynek bez zakłóceń.',
      metrics: {
        steps: 2850,
        sleep_hours: 8.1
      }
    });

    await sql`
      INSERT INTO public.daily_reports (
        resident_id, author_id, approved_by, content, status, ai_generated, approved_at, created_at
      )
      VALUES 
        (
          ${res1.id},
          ${nurseUser?.id || null},
          ${nurseUser?.id || null},
          ${reportContent1}::jsonb,
          'PUBLISHED',
          false,
          ${hoursAgo(6)},
          ${hoursAgo(8)}
        ),
        (
          ${res3.id},
          ${nurseUser?.id || null},
          ${nurseUser?.id || null},
          ${reportContent2}::jsonb,
          'PUBLISHED',
          false,
          ${hoursAgo(5)},
          ${hoursAgo(7)}
        )
    `;
    console.log('✅ Dodano 2 zatwierdzone raporty dobowe w daily_reports.');
  }

  // 8. Podsumowanie
  const summary = await sql`
    SELECT
      (SELECT count(*) FROM public.family_messages) as total_messages,
      (SELECT count(DISTINCT resident_id) FROM public.family_messages) as residents_with_messages,
      (SELECT count(*) FROM public.daily_reports) as total_reports
  `;
  console.log('Podsumowanie bazy danych:', summary[0]);
  console.log('--- Zakończono sukcesem! ---');

  await sql.end();
}

seedMessagesAndReports().catch((err) => {
  console.error('Błąd podczas seedowania:', err);
  process.exit(1);
});
