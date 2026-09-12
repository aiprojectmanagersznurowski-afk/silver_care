import postgres from 'postgres';
import * as dotenv from 'dotenv';
import { createHmac } from 'crypto';

dotenv.config({ path: '.env.local' });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL is required in .env.local');
}

const salt = process.env.PESEL_HASH_SALT || 'silver-care-default-salt';
const sql = postgres(dbUrl, { prepare: false });

function hashPesel(peselStr) {
  return createHmac('sha256', salt).update(peselStr).digest('hex');
}

async function seed() {
  console.log('--- Rozpoczynam generowanie danych demonstracyjnych BI ---');

  // 1. Pobierz organizację
  const orgs = await sql`SELECT id, name FROM public.organizations LIMIT 1`;
  if (orgs.length === 0) {
    throw new Error('Brak organizacji w bazie danych.');
  }
  const orgId = orgs[0].id;
  console.log(`Organizacja: ${orgs[0].name} (${orgId})`);

  // Pobierz użytkownika personelu / admina do pola performed_by
  const users = await sql`
    SELECT id FROM auth.users
    WHERE raw_app_meta_data->>'role' IN ('super_admin', 'org_admin', 'nurse')
    LIMIT 1
  `;
  const staffUserId = users.length > 0 ? users[0].id : null;

  // Pobierz użytkowników rodziny do powiązań
  const familyUsers = await sql`
    SELECT id FROM auth.users
    WHERE raw_app_meta_data->>'role' = 'family'
  `;
  const familyIds = familyUsers.map(u => u.id);

  // 2. Dezaktywuj stare pokoje testowe i ich przypisania
  console.log('2. Porządkowanie starych pokoi testowych...');
  await sql`
    UPDATE public.bed_assignments
    SET unassigned_at = '2026-06-30 23:59:59+00'
    WHERE unassigned_at IS NULL
      AND bed_id IN (
        SELECT b.id FROM public.beds b
        JOIN public.rooms r ON r.id = b.room_id
        WHERE r.organization_id = ${orgId} AND r.number IN ('1', '2')
      )
  `;
  await sql`
    UPDATE public.beds
    SET is_active = false
    WHERE room_id IN (
      SELECT id FROM public.rooms
      WHERE organization_id = ${orgId} AND number IN ('1', '2')
    )
  `;
  await sql`
    UPDATE public.rooms
    SET is_active = false
    WHERE organization_id = ${orgId} AND number IN ('1', '2')
  `;

  // 3. Utwórz 16 pokoi po 2 łóżka (łącznie 32 miejsca)
  console.log('3. Tworzenie 16 pokoi po 2 łóżka...');
  const roomDefs = [
    // Piętro 1 — Sektor A
    { number: '101', floor: '1', sector: 'Sektor A' },
    { number: '102', floor: '1', sector: 'Sektor A' },
    { number: '103', floor: '1', sector: 'Sektor A' },
    { number: '104', floor: '1', sector: 'Sektor A' },
    { number: '105', floor: '1', sector: 'Sektor A' },
    { number: '106', floor: '1', sector: 'Sektor A' },
    { number: '107', floor: '1', sector: 'Sektor A' },
    { number: '108', floor: '1', sector: 'Sektor A' },
    // Piętro 2 — Sektor B
    { number: '201', floor: '2', sector: 'Sektor B' },
    { number: '202', floor: '2', sector: 'Sektor B' },
    { number: '203', floor: '2', sector: 'Sektor B' },
    { number: '204', floor: '2', sector: 'Sektor B' },
    { number: '205', floor: '2', sector: 'Sektor B' },
    { number: '206', floor: '2', sector: 'Sektor B' },
    { number: '207', floor: '2', sector: 'Sektor B' },
    { number: '208', floor: '2', sector: 'Sektor B' },
  ];

  const createdRooms = [];
  const createdBeds = [];

  for (const r of roomDefs) {
    // Sprawdź czy pokój już istnieje
    let [room] = await sql`
      SELECT id FROM public.rooms
      WHERE organization_id = ${orgId} AND number = ${r.number}
    `;

    if (!room) {
      [room] = await sql`
        INSERT INTO public.rooms (organization_id, number, floor, sector, is_active)
        VALUES (${orgId}, ${r.number}, ${r.floor}, ${r.sector}, true)
        RETURNING id
      `;
    } else {
      await sql`
        UPDATE public.rooms
        SET floor = ${r.floor}, sector = ${r.sector}, is_active = true
        WHERE id = ${room.id}
      `;
    }
    createdRooms.push({ ...r, id: room.id });

    // Dwa łóżka: '1' i '2'
    for (const label of ['1', '2']) {
      let [bed] = await sql`
        SELECT id FROM public.beds
        WHERE room_id = ${room.id} AND label = ${label}
      `;

      if (!bed) {
        [bed] = await sql`
          INSERT INTO public.beds (room_id, label, is_active)
          VALUES (${room.id}, ${label}, true)
          RETURNING id
        `;
      } else {
        await sql`UPDATE public.beds SET is_active = true WHERE id = ${bed.id}`;
      }
      createdBeds.push({ id: bed.id, room_id: room.id, roomNumber: r.number, label });
    }
  }

  console.log(`   ✓ Utworzono/zaktualizowano ${createdRooms.length} pokoi i ${createdBeds.length} łóżek.`);

  // 4. Definicje podopiecznych (dane demograficzne i umowy)
  console.log('4. Przygotowanie danych podopiecznych...');

  // 36 pensjonariuszy z kompletnymi danymi
  const residentDefs = [
    // Pokój 101
    {
      firstName: 'Stanisław', lastName: 'Wiśniewski', gender: 'M', birthDate: '1938-04-12', peselStr: '38041201234',
      admissionDate: '2025-03-10', contractStart: '2025-03-10', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'walking', source: 'referral', monthlyRate: 6200, notes: 'Lubi spacery w ogrodzie. Samodzielny.',
      bedIndex: 0, packageType: 'rehabilitation', packageName: 'Rehabilitacja ruchowa', packageRate: 500,
    },
    {
      firstName: 'Helena', lastName: 'Dąbrowska', gender: 'F', birthDate: '1941-09-23', peselStr: '41092302345',
      admissionDate: '2026-09-11', contractStart: '2026-09-11', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'sitting', source: 'internet', monthlyRate: 6500, notes: 'Nowo przyjęta. Wymaga asekuracji przy wstawaniu.',
      bedIndex: 1, packageType: 'zsn', packageName: 'Pakiet ZSN', packageRate: 450,
    },

    // Pokój 102
    {
      firstName: 'Józef', lastName: 'Kamiński', gender: 'M', birthDate: '1936-11-05', peselStr: '36110503456',
      admissionDate: '2024-11-15', contractStart: '2024-11-15', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'bedridden', source: 'hospital', monthlyRate: 7500, notes: 'Po udarze. Dieta miksowana. Rehabilitacja przyłóżkowa.',
      bedIndex: 2, packageType: 'physiotherapy', packageName: 'Fizjoterapia indywidualna', packageRate: 600,
    },
    {
      firstName: 'Krystyna', lastName: 'Lewandowska', gender: 'F', birthDate: '1944-02-18', peselStr: '44021804567',
      admissionDate: '2025-06-01', contractStart: '2025-06-01', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'walking', source: 'family_recommendation', monthlyRate: 5800, notes: 'Aktywna społecznie, uczestniczy w warsztatach.',
      bedIndex: 3, packageType: null, packageName: null, packageRate: null,
    },

    // Pokój 103
    {
      firstName: 'Kazimierz', lastName: 'Wójcik', gender: 'M', birthDate: '1939-08-30', peselStr: '39083005678',
      admissionDate: '2025-01-20', contractStart: '2025-01-20', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'sitting', source: 'internet', monthlyRate: 6400, notes: 'Porusza się na wózku. Lubi czytać prasę.',
      bedIndex: 4, packageType: 'rehabilitation', packageName: 'Rehabilitacja', packageRate: 500,
    },
    {
      firstName: 'Irena', lastName: 'Szymańska', gender: 'F', birthDate: '1942-12-14', peselStr: '42121406789',
      admissionDate: '2026-09-02', contractStart: '2026-09-02', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'walking', source: 'mops', monthlyRate: 5900, notes: 'Przyjęta we wrześniu. Adaptacja przebiega pomyślnie.',
      bedIndex: 5, packageType: null, packageName: null, packageRate: null,
    },

    // Pokój 104
    {
      firstName: 'Tadeusz', lastName: 'Woźniak', gender: 'M', birthDate: '1935-05-20', peselStr: '35052007890',
      admissionDate: '2024-08-10', contractStart: '2024-08-10', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'hospice', source: 'hospital', monthlyRate: 8200, notes: 'Stan hospicyjny. Tlenoterapia doraźna.',
      bedIndex: 6, packageType: 'zsn', packageName: 'Opieka paliatywna ZSN', packageRate: 700,
    },
    {
      firstName: 'Teresa', lastName: 'Kozłowska', gender: 'F', birthDate: '1946-07-09', peselStr: '46070908901',
      admissionDate: '2026-08-28', contractStart: '2026-08-28', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'sitting', source: 'referral', monthlyRate: 6300, notes: 'Przyjęta pod koniec sierpnia. Dobry kontakt z personelem.',
      bedIndex: 7, packageType: 'physiotherapy', packageName: 'Fizjoterapia', packageRate: 550,
    },

    // Pokój 105
    {
      firstName: 'Mieczysław', lastName: 'Jankowski', gender: 'M', birthDate: '1940-03-03', peselStr: '40030309012',
      admissionDate: '2025-04-15', contractStart: '2025-04-15', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'walking', source: 'internet', monthlyRate: 6000, notes: 'Samodzielny. Chętnie gra w szachy.',
      bedIndex: 8, packageType: null, packageName: null, packageRate: null,
    },
    // bedIndex 9 (Pokój 105 łóżko 2) -> WOLNE ŁÓŻKO

    // Pokój 106
    {
      firstName: 'Danuta', lastName: 'Mazur', gender: 'F', birthDate: '1943-10-27', peselStr: '43102710123',
      admissionDate: '2026-07-05', contractStart: '2026-07-05', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'sitting', source: 'referral', monthlyRate: 6600, notes: 'Przyjęta w lipcu. Terapia zajęciowa.',
      bedIndex: 10, packageType: 'speech_therapy', packageName: 'Logopedia', packageRate: 400,
    },
    {
      firstName: 'Henryk', lastName: 'Kwiatkowski', gender: 'M', birthDate: '1937-01-19', peselStr: '37011911234',
      admissionDate: '2025-09-01', contractStart: '2025-09-01', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'bedridden', source: 'hospital', monthlyRate: 7400, notes: 'Wymaga karmienia i toalety w łóżku.',
      bedIndex: 11, packageType: 'rehabilitation', packageName: 'Rehabilitacja przyłóżkowa', packageRate: 600,
    },

    // Pokój 107
    {
      firstName: 'Janina', lastName: 'Krawczyk', gender: 'F', birthDate: '1945-06-15', peselStr: '45061512345',
      admissionDate: '2025-08-10', contractStart: '2025-08-10', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'walking', source: 'family_recommendation', monthlyRate: 5900, notes: 'Sprawna fizycznie, spacery codzienne.',
      bedIndex: 12, packageType: null, packageName: null, packageRate: null,
    },
    {
      firstName: 'Edward', lastName: 'Piotrowski', gender: 'M', birthDate: '1942-04-08', peselStr: '42040813456',
      admissionDate: '2026-08-15', contractStart: '2026-08-15', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'sitting', source: 'internet', monthlyRate: 6400, notes: 'Przyjęty w połowie sierpnia po zgonie poprzedniego lokatora.',
      bedIndex: 13, packageType: 'rehabilitation', packageName: 'Rehabilitacja', packageRate: 500,
    },

    // Pokój 108
    {
      firstName: 'Zofia', lastName: 'Grabowska', gender: 'F', birthDate: '1939-11-22', peselStr: '39112214567',
      admissionDate: '2026-09-12', contractStart: '2026-09-12', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'walking', source: 'family_recommendation', monthlyRate: 6100, notes: 'Przyjęta dzisiaj. Adaptacja w toku.',
      bedIndex: 14, packageType: null, packageName: null, packageRate: null,
    },
    // bedIndex 15 (Pokój 108 łóżko 2) -> WOLNE ŁÓŻKO

    // Pokój 201
    {
      firstName: 'Ryszard', lastName: 'Pawłowski', gender: 'M', birthDate: '1940-08-11', peselStr: '40081115678',
      admissionDate: '2025-02-14', contractStart: '2025-02-14', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'walking', source: 'referral', monthlyRate: 6000, notes: 'Lubi prace manualne i ogrodnictwo.',
      bedIndex: 16, packageType: null, packageName: null, packageRate: null,
    },
    {
      firstName: 'Jadwiga', lastName: 'Michalska', gender: 'F', birthDate: '1936-09-17', peselStr: '36091716789',
      admissionDate: '2024-10-01', contractStart: '2024-10-01', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'bedridden', source: 'hospital', monthlyRate: 7600, notes: 'Ograniczona ruchomość kończyn dolnych.',
      bedIndex: 17, packageType: 'physiotherapy', packageName: 'Fizjoterapia', packageRate: 550,
    },

    // Pokój 202
    {
      firstName: 'Jerzy', lastName: 'Nowicki', gender: 'M', birthDate: '1943-05-29', peselStr: '43052917890',
      admissionDate: '2025-07-20', contractStart: '2025-07-20', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'sitting', source: 'mops', monthlyRate: 5800, notes: 'Spokojny, chętnie ogląda filmy i koncerty.',
      bedIndex: 18, packageType: null, packageName: null, packageRate: null,
    },
    {
      firstName: 'Halina', lastName: 'Adamczyk', gender: 'F', birthDate: '1947-01-04', peselStr: '47010418901',
      admissionDate: '2026-07-22', contractStart: '2026-07-22', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'walking', source: 'internet', monthlyRate: 6300, notes: 'Przyjęta w lipcu. Bardzo zintegrowana z grupą.',
      bedIndex: 19, packageType: 'zsn', packageName: 'Pakiet ZSN', packageRate: 450,
    },

    // Pokój 203
    {
      firstName: 'Władysław', lastName: 'Dudek', gender: 'M', birthDate: '1934-12-08', peselStr: '34120819012',
      admissionDate: '2024-05-18', contractStart: '2024-05-18', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'hospice', source: 'hospital', monthlyRate: 8500, notes: 'Stan terminalny. Wymaga stałej opieki pielęgniarskiej.',
      bedIndex: 20, packageType: 'zsn', packageName: 'Pakiet paliatywny', packageRate: 700,
    },
    {
      firstName: 'Barbara', lastName: 'Zając', gender: 'F', birthDate: '1944-09-30', peselStr: '44093020123',
      admissionDate: '2026-09-09', contractStart: '2026-09-09', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'sitting', source: 'family_recommendation', monthlyRate: 6500, notes: 'Przyjęta we wrześniu po zgonie poprzedniego pensjonariusza.',
      bedIndex: 21, packageType: 'rehabilitation', packageName: 'Rehabilitacja', packageRate: 500,
    },

    // Pokój 204
    {
      firstName: 'Marian', lastName: 'Wieczorek', gender: 'M', birthDate: '1941-03-14', peselStr: '41031421234',
      admissionDate: '2025-05-10', contractStart: '2025-05-10', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'walking', source: 'referral', monthlyRate: 6100, notes: 'Samodzielny w czynnościach codziennych.',
      bedIndex: 22, packageType: null, packageName: null, packageRate: null,
    },
    // bedIndex 23 (Pokój 204 łóżko 2) -> WOLNE ŁÓŻKO

    // Pokój 205
    {
      firstName: 'Elżbieta', lastName: 'Jabłońska', gender: 'F', birthDate: '1938-07-25', peselStr: '38072522345',
      admissionDate: '2026-08-03', contractStart: '2026-08-03', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'bedridden', source: 'hospital', monthlyRate: 7200, notes: 'Przyjęta na początku sierpnia po wypisie na życzenie rodziny poprzednika.',
      bedIndex: 24, packageType: 'physiotherapy', packageName: 'Fizjoterapia', packageRate: 550,
    },
    {
      firstName: 'Roman', lastName: 'Majewski', gender: 'M', birthDate: '1945-11-19', peselStr: '45111923456',
      admissionDate: '2025-11-01', contractStart: '2025-11-01', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'walking', source: 'internet', monthlyRate: 5900, notes: 'Aktywny, lubi spacery po placówce.',
      bedIndex: 25, packageType: null, packageName: null, packageRate: null,
    },

    // Pokój 206
    {
      firstName: 'Wanda', lastName: 'Olszewska', gender: 'F', birthDate: '1935-02-28', peselStr: '35022824567',
      admissionDate: '2024-09-15', contractStart: '2024-09-15', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'hospice', source: 'hospital', monthlyRate: 8400, notes: 'Wymaga stałego monitorowania i wsparcia bólowego.',
      bedIndex: 26, packageType: 'zsn', packageName: 'Pakiet paliatywny', packageRate: 700,
    },
    {
      firstName: 'Bogdan', lastName: 'Jaworski', gender: 'M', birthDate: '1942-06-03', peselStr: '42060325678',
      admissionDate: '2025-08-01', contractStart: '2025-08-01', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'sitting', source: 'mops', monthlyRate: 6200, notes: 'Uczęszcza na zajęcia fizjoterapeutyczne.',
      bedIndex: 27, packageType: 'rehabilitation', packageName: 'Rehabilitacja', packageRate: 500,
    },

    // Pokój 207
    {
      firstName: 'Cecylia', lastName: 'Malinowska', gender: 'F', birthDate: '1946-10-10', peselStr: '46101026789',
      admissionDate: '2026-08-30', contractStart: '2026-08-30', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'walking', source: 'internet', monthlyRate: 6400, notes: 'Przyjęta pod koniec sierpnia po przeniesieniu poprzedniego lokatora.',
      bedIndex: 28, packageType: null, packageName: null, packageRate: null,
    },
    {
      firstName: 'Zbigniew', lastName: 'Stępień', gender: 'M', birthDate: '1939-01-15', peselStr: '39011527890',
      admissionDate: '2025-03-25', contractStart: '2025-03-25', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'bedridden', source: 'hospital', monthlyRate: 7300, notes: 'Wymaga regularnej zmiany pozycji przeciwodleżynowej.',
      bedIndex: 29, packageType: 'physiotherapy', packageName: 'Fizjoterapia', packageRate: 550,
    },

    // Pokój 208
    {
      firstName: 'Eugenia', lastName: 'Górka', gender: 'F', birthDate: '1943-08-08', peselStr: '43080828901',
      admissionDate: '2025-10-12', contractStart: '2025-10-12', contractEnd: null, endReason: null, deathDate: null,
      careLevel: 'sitting', source: 'family_recommendation', monthlyRate: 6300, notes: 'Spokojna, chętnie uczestniczy w spotkaniach integracyjnych.',
      bedIndex: 30, packageType: null, packageName: null, packageRate: null,
    },
    // bedIndex 31 (Pokój 208 łóżko 2) -> WOLNE ŁÓŻKO

    // ── Byli pensjonariusze (zakończone umowy i zgony w lipcu, sierpniu, wrześniu 2026) ──

    // 1. Zgon w lipcu (2026-07-18) — długość pobytu >2 lata (przyjęty 2024-01-10)
    {
      firstName: 'Antoni', lastName: 'Witkowski', gender: 'M', birthDate: '1933-04-05', peselStr: '33040529012',
      admissionDate: '2024-01-10', contractStart: '2024-01-10', contractEnd: '2026-07-18', endReason: 'death', deathDate: '2026-07-18',
      careLevel: 'hospice', source: 'hospital', monthlyRate: 7800, notes: 'Pobyt 920 dni (>2 lata). Spokojna śmierć.',
      bedIndex: 19, pastBed: true, pastAssignedAt: '2024-01-10', pastUnassignedAt: '2026-07-18',
    },

    // 2. Wypis na życzenie rodziny w lipcu (2026-07-28)
    {
      firstName: 'Genowefa', lastName: 'Walczak', gender: 'F', birthDate: '1945-12-01', peselStr: '45120130123',
      admissionDate: '2025-05-01', contractStart: '2025-05-01', contractEnd: '2026-07-28', endReason: 'family_request', deathDate: null,
      careLevel: 'walking', source: 'family_recommendation', monthlyRate: 5900, notes: 'Wypisana na życzenie rodziny — opieka domowa.',
      bedIndex: 24, pastBed: true, pastAssignedAt: '2025-05-01', pastUnassignedAt: '2026-07-28',
    },

    // 3. Zgon w sierpniu (2026-08-11) — długość pobytu 1-2 lata (przyjęty 2025-02-01, ~556 dni)
    {
      firstName: 'Czesław', lastName: 'Rutkowski', gender: 'M', birthDate: '1937-06-21', peselStr: '37062131234',
      admissionDate: '2025-02-01', contractStart: '2025-02-01', contractEnd: '2026-08-11', endReason: 'death', deathDate: '2026-08-11',
      careLevel: 'bedridden', source: 'hospital', monthlyRate: 7200, notes: 'Pobyt 556 dni (1-2 lata).',
      bedIndex: 13, pastBed: true, pastAssignedAt: '2025-02-01', pastUnassignedAt: '2026-08-11',
    },

    // 4. Przeniesienie do innego ośrodka w sierpniu (2026-08-19)
    {
      firstName: 'Stefania', lastName: 'Michalak', gender: 'F', birthDate: '1940-11-11', peselStr: '40111132345',
      admissionDate: '2025-09-10', contractStart: '2025-09-10', contractEnd: '2026-08-19', endReason: 'transfer', deathDate: null,
      careLevel: 'sitting', source: 'referral', monthlyRate: 6300, notes: 'Przeniesiona do placówki bliżej miejsca zamieszkania córki.',
      bedIndex: 28, pastBed: true, pastAssignedAt: '2025-09-10', pastUnassignedAt: '2026-08-19',
    },

    // 5. Zgon w sierpniu (2026-08-25) — pobyt 75 dni (przyjęty 2026-06-11, kategoria 31-90 dni)
    {
      firstName: 'Włodzimierz', lastName: 'Sikora', gender: 'M', birthDate: '1936-02-17', peselStr: '36021733456',
      admissionDate: '2026-06-11', contractStart: '2026-06-11', contractEnd: '2026-08-25', endReason: 'death', deathDate: '2026-08-25',
      careLevel: 'hospice', source: 'hospital', monthlyRate: 8000, notes: 'Pobyt 75 dni (31-90 dni).',
      bedIndex: 7, pastBed: true, pastAssignedAt: '2026-06-11', pastUnassignedAt: '2026-08-25',
    },

    // 6. Zgon we wrześniu (2026-09-04) — pobyt 125 dni (przyjęty 2026-05-02, kategoria 91-180 dni)
    {
      firstName: 'Stanisława', lastName: 'Ostrowska', gender: 'F', birthDate: '1938-10-15', peselStr: '38101534567',
      admissionDate: '2026-05-02', contractStart: '2026-05-02', contractEnd: '2026-09-04', endReason: 'death', deathDate: '2026-09-04',
      careLevel: 'bedridden', source: 'referral', monthlyRate: 7100, notes: 'Pobyt 125 dni (91-180 dni).',
      bedIndex: 21, pastBed: true, pastAssignedAt: '2026-05-02', pastUnassignedAt: '2026-09-04',
    },

    // 7. Poprawa stanu zdrowia we wrześniu (2026-09-08)
    {
      firstName: 'Bolesław', lastName: 'Baran', gender: 'M', birthDate: '1944-07-20', peselStr: '44072035678',
      admissionDate: '2026-04-10', contractStart: '2026-04-10', contractEnd: '2026-09-08', endReason: 'health_improvement', deathDate: null,
      careLevel: 'walking', source: 'internet', monthlyRate: 5900, notes: 'Poprawa stanu zdrowia po rehabilitacji i powrót do domu.',
      bedIndex: 1, pastBed: true, pastAssignedAt: '2026-04-10', pastUnassignedAt: '2026-09-08',
    },

    // 8. Byli zmarli z wcześniejszych miesięcy (do zasilenia histogramu stażu przed zgonem)
    {
      firstName: 'Franciszek', lastName: 'Czarnecki', gender: 'M', birthDate: '1934-03-01', peselStr: '34030136789',
      admissionDate: '2026-02-10', contractStart: '2026-02-10', contractEnd: '2026-03-05', endReason: 'death', deathDate: '2026-03-05',
      careLevel: 'hospice', source: 'hospital', monthlyRate: 8000, notes: 'Pobyt 23 dni (≤30 dni).',
      bedIndex: null, pastBed: false,
    },
    {
      firstName: 'Maria', lastName: 'Włodarczyk', gender: 'F', birthDate: '1935-12-12', peselStr: '35121237890',
      admissionDate: '2025-06-01', contractStart: '2025-06-01', contractEnd: '2026-01-15', endReason: 'death', deathDate: '2026-01-15',
      careLevel: 'bedridden', source: 'referral', monthlyRate: 7400, notes: 'Pobyt 228 dni (181-365 dni).',
      bedIndex: null, pastBed: false,
    },
    {
      firstName: 'Lucyna', lastName: 'Borkowska', gender: 'F', birthDate: '1932-09-05', peselStr: '32090538901',
      admissionDate: '2023-08-01', contractStart: '2023-08-01', contractEnd: '2026-04-20', endReason: 'death', deathDate: '2026-04-20',
      careLevel: 'hospice', source: 'mops', monthlyRate: 7900, notes: 'Pobyt 993 dni (>2 lata).',
      bedIndex: null, pastBed: false,
    },
  ];

  console.log(`Zdefiniowano ${residentDefs.length} podopiecznych.`);

  // 5. Zapisz pensjonariuszy, łóżka i zdarzenia
  console.log('5. Zapisywanie pensjonariuszy i zdarzeń...');

  for (const def of residentDefs) {
    const peselHash = hashPesel(def.peselStr);

    // Sprawdź czy pensjonariusz już istnieje po imieniu i nazwisku w tej org
    let [resident] = await sql`
      SELECT id FROM public.residents
      WHERE organization_id = ${orgId}
        AND first_name = ${def.firstName}
        AND last_name = ${def.lastName}
    `;

    if (!resident) {
      [resident] = await sql`
        INSERT INTO public.residents (
          organization_id, first_name, last_name, pesel_hash,
          birth_date, gender, admission_date, contract_start_date,
          contract_end_date, contract_end_reason, death_date,
          care_level, contract_source, contract_monthly_rate, notes,
          is_zsn, created_at
        ) VALUES (
          ${orgId}, ${def.firstName}, ${def.lastName}, ${peselHash},
          ${def.birthDate}, ${def.gender}, ${def.admissionDate}, ${def.contractStart},
          ${def.contractEnd}, ${def.endReason}, ${def.deathDate},
          ${def.careLevel}, ${def.source}, ${def.monthlyRate}, ${def.notes},
          ${Boolean(def.careLevel === 'hospice' || def.careLevel === 'bedridden' || def.packageType === 'zsn')},
          ${def.admissionDate}::timestamptz
        ) RETURNING id
      `;
    } else {
      await sql`
        UPDATE public.residents
        SET
          birth_date = ${def.birthDate},
          gender = ${def.gender},
          admission_date = ${def.admissionDate},
          contract_start_date = ${def.contractStart},
          contract_end_date = ${def.contractEnd},
          contract_end_reason = ${def.endReason},
          death_date = ${def.deathDate},
          care_level = ${def.careLevel},
          contract_source = ${def.source},
          contract_monthly_rate = ${def.monthlyRate},
          notes = ${def.notes},
          is_zsn = ${Boolean(def.careLevel === 'hospice' || def.careLevel === 'bedridden' || def.packageType === 'zsn')}
        WHERE id = ${resident.id}
      `;
    }

    const residentId = resident.id;

    // Przypisanie łóżka
    if (def.bedIndex !== null && def.bedIndex < createdBeds.length) {
      const targetBed = createdBeds[def.bedIndex];

      if (def.pastBed) {
        // Poprzednie przypisanie z unassigned_at
        await sql`
          DELETE FROM public.bed_assignments
          WHERE resident_id = ${residentId}
        `;
        await sql`
          INSERT INTO public.bed_assignments (bed_id, resident_id, assigned_at, unassigned_at)
          VALUES (${targetBed.id}, ${residentId}, ${def.pastAssignedAt}::timestamptz, ${def.pastUnassignedAt}::timestamptz)
        `;
      } else {
        // Aktywne przypisanie
        // Najpierw zamknij ewentualne stare przypisanie tego pensjonariusza
        await sql`
          DELETE FROM public.bed_assignments
          WHERE resident_id = ${residentId}
        `;
        // I upewnij się, że na tym łóżku nie ma innego aktywnego przypisania
        await sql`
          DELETE FROM public.bed_assignments
          WHERE bed_id = ${targetBed.id} AND unassigned_at IS NULL
        `;
        await sql`
          INSERT INTO public.bed_assignments (bed_id, resident_id, assigned_at, unassigned_at)
          VALUES (${targetBed.id}, ${residentId}, ${def.admissionDate}::timestamptz, NULL)
        `;
      }
    }

    // Historia stanu (resident_care_level_history)
    await sql`DELETE FROM public.resident_care_level_history WHERE resident_id = ${residentId}`;
    await sql`
      INSERT INTO public.resident_care_level_history (resident_id, care_level, changed_at, changed_by)
      VALUES (${residentId}, ${def.careLevel}, ${def.admissionDate}::date, ${staffUserId})
    `;

    // Pakiety (resident_packages)
    if (def.packageType && def.packageName) {
      await sql`DELETE FROM public.resident_packages WHERE resident_id = ${residentId}`;
      await sql`
        INSERT INTO public.resident_packages (
          organization_id, resident_id, package_type, package_name, monthly_rate, started_at
        ) VALUES (
          ${orgId}, ${residentId}, ${def.packageType}, ${def.packageName}, ${def.packageRate}, ${def.admissionDate}::date
        )
      `;
    }

    // Zdarzenia (resident_events)
    await sql`DELETE FROM public.resident_events WHERE resident_id = ${residentId}`;

    // 1. Zdarzenie przyjęcia
    await sql`
      INSERT INTO public.resident_events (
        organization_id, resident_id, event_type, event_date, performed_by, metadata
      ) VALUES (
        ${orgId}, ${residentId}, 'admission', ${def.admissionDate}::date, ${staffUserId}, '{}'::jsonb
      )
    `;

    // 2. Zdarzenie podpisania umowy
    await sql`
      INSERT INTO public.resident_events (
        organization_id, resident_id, event_type, event_date, performed_by, metadata
      ) VALUES (
        ${orgId}, ${residentId}, 'contract_signed', ${def.contractStart}::date, ${staffUserId},
        ${sql.json({ contract_value: def.monthlyRate, source: def.source })}
      )
    `;

    // 3. Ewentualne zdarzenie zgonu
    if (def.deathDate) {
      await sql`
        INSERT INTO public.resident_events (
          organization_id, resident_id, event_type, event_date, event_reason, performed_by, metadata
        ) VALUES (
          ${orgId}, ${residentId}, 'death', ${def.deathDate}::date, 'death', ${staffUserId}, '{}'::jsonb
        )
      `;
    }

    // 4. Ewentualne zdarzenie zakończenia umowy
    if (def.contractEnd) {
      await sql`
        INSERT INTO public.resident_events (
          organization_id, resident_id, event_type, event_date, event_reason, performed_by, metadata
        ) VALUES (
          ${orgId}, ${residentId}, 'contract_ended', ${def.contractEnd}::date, ${def.endReason}, ${staffUserId}, '{}'::jsonb
        )
      `;
    }

    // 5. Powiązanie z bliskimi dla pierwszych kilku pensjonariuszy
    if (familyIds.length > 0 && Math.random() > 0.4) {
      const familyId = familyIds[Math.floor(Math.random() * familyIds.length)];
      await sql`DELETE FROM public.resident_relative_links WHERE resident_id = ${residentId}`;
      await sql`
        INSERT INTO public.resident_relative_links (
          resident_id, relative_user_id, relationship_code, role
        ) VALUES (
          ${residentId}, ${familyId}, 'Córka / Syn', 'family'
        )
      `;
    }
  }

  // 6. Weryfikacja agregatów BI po wygenerowaniu
  console.log('6. Weryfikacja wygenerowanych widoków BI...');

  const [julySummary] = await sql`
    SELECT * FROM public.fn_monthly_summary(${orgId}, 2026, 7)
  `;
  console.log('Lipiec 2026 podsumowanie:', julySummary);

  const [augSummary] = await sql`
    SELECT * FROM public.fn_monthly_summary(${orgId}, 2026, 8)
  `;
  console.log('Sierpień 2026 podsumowanie:', augSummary);

  const [septSummary] = await sql`
    SELECT * FROM public.fn_monthly_summary(${orgId}, 2026, 9)
  `;
  console.log('Wrzesień 2026 podsumowanie:', septSummary);

  const careStats = await sql`SELECT * FROM public.fn_care_level_stats(${orgId})`;
  console.log('Stany pensjonariuszy:', careStats);

  const [kpi] = await sql`SELECT * FROM public.fn_occupancy_kpi(${orgId})`;
  console.log('KPI obłożenia:', kpi);

  await sql.end();
  console.log('--- Dane demonstracyjne BI wygenerowane pomyślnie! ---');
}

seed().catch((err) => {
  console.error('Błąd podczas seedowania:', err);
  process.exit(1);
});
