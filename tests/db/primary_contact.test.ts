import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import postgres from 'postgres';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

/**
 * Testy bazy danych dla pojedynczego kontaktu głównego podopiecznego (SC-ADM-03 AC3).
 * @REQ: ADM-RESIDENT-ADD
 * @REQ: ADM-INVITE
 */
describe('Primary Contact Validation in resident_relative_links (SC-ADM-03 AC3)', () => {
  beforeAll(async () => {
    await sql`RESET ROLE`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it('automatically clears previous primary contact when a new one is set to true @REQ: ADM-RESIDENT-ADD', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;

      // 1. Placówka i podopieczny
      const [org] = await tx`INSERT INTO organizations (name) VALUES ('Org Primary Test') RETURNING id`;
      const [resident] = await tx`
        INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
        VALUES (${org.id}, 'Marian', 'Podopieczny', 'marian-hash')
        RETURNING id
      `;

      const userAId = '11111111-1111-4111-a111-111111111111';
      const userBId = '22222222-2222-4222-a222-222222222222';

      // 2. Dodajemy pierwszego krewnego jako kontakt główny
      const [link1] = await tx`
        INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role, is_primary_contact)
        VALUES (${resident.id}, ${userAId}, 'córka', 'legal_guardian', true)
        RETURNING id, is_primary_contact
      `;
      expect(link1.is_primary_contact).toBe(true);

      // 3. Dodajemy drugiego krewnego, również jako kontakt główny
      const [link2] = await tx`
        INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role, is_primary_contact)
        VALUES (${resident.id}, ${userBId}, 'syn', 'family', true)
        RETURNING id, is_primary_contact
      `;
      expect(link2.is_primary_contact).toBe(true);

      // 4. Weryfikacja: pierwszy krewny musi mieć teraz is_primary_contact = false
      const [recheckLink1] = await tx`
        SELECT is_primary_contact FROM resident_relative_links WHERE id = ${link1.id}
      `;
      expect(recheckLink1.is_primary_contact).toBe(false);

      // 5. Aktualizacja pierwszego krewnego z powrotem na kontakt główny
      await tx`
        UPDATE resident_relative_links
        SET is_primary_contact = true
        WHERE id = ${link1.id}
      `;

      // 6. link1 staje się true, link2 staje się false
      const [finalLink1] = await tx`SELECT is_primary_contact FROM resident_relative_links WHERE id = ${link1.id}`;
      const [finalLink2] = await tx`SELECT is_primary_contact FROM resident_relative_links WHERE id = ${link2.id}`;

      expect(finalLink1.is_primary_contact).toBe(true);
      expect(finalLink2.is_primary_contact).toBe(false);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });

  it('maintains isolation between different residents @REQ: ADM-INVITE', async () => {
    await sql.begin(async (tx) => {
      await tx`SET LOCAL ROLE postgres`;

      const [org] = await tx`INSERT INTO organizations (name) VALUES ('Org Primary Iso') RETURNING id`;
      const [resA] = await tx`
        INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
        VALUES (${org.id}, 'Senior A', 'Test', 'hash-a')
        RETURNING id
      `;
      const [resB] = await tx`
        INSERT INTO residents (organization_id, first_name, last_name, pesel_hash)
        VALUES (${org.id}, 'Senior B', 'Test', 'hash-b')
        RETURNING id
      `;

      const user1 = '33333333-3333-4333-a333-333333333333';
      const user2 = '44444444-4444-4444-a444-444444444444';

      // Ustawienie kontaktu głównego dla Seniora A i Seniora B
      await tx`
        INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role, is_primary_contact)
        VALUES (${resA.id}, ${user1}, 'syn', 'legal_guardian', true)
      `;
      await tx`
        INSERT INTO resident_relative_links (resident_id, relative_user_id, relationship_code, role, is_primary_contact)
        VALUES (${resB.id}, ${user2}, 'córka', 'family', true)
      `;

      // Obydwa rekordy muszą pozostać true (izolacja po resident_id)
      const linksA = await tx`SELECT is_primary_contact FROM resident_relative_links WHERE resident_id = ${resA.id}`;
      const linksB = await tx`SELECT is_primary_contact FROM resident_relative_links WHERE resident_id = ${resB.id}`;

      expect(linksA[0].is_primary_contact).toBe(true);
      expect(linksB[0].is_primary_contact).toBe(true);

      throw new Error('ROLLBACK');
    }).catch((e) => {
      if (e.message !== 'ROLLBACK') throw e;
    });
  });
});
