import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'

/**
 * @REQ: NTF-REPORT-READY
 */
describe('Outbox Concurrency & SKIP LOCKED (@REQ: NTF-REPORT-READY)', () => {
  let sql: postgres.Sql
  const testOrgId = '00000000-0000-0000-0000-000000000001'
  const createdNotificationIds: string[] = []

  beforeAll(async () => {
    sql = postgres(process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres')

    // Wstawiamy 10 testowych powiadomień
    for (let i = 0; i < 10; i++) {
      const [res] = await sql`
        INSERT INTO public.outbox_notifications (
          organization_id,
          entity_type,
          entity_id,
          payload,
          status,
          next_retry_at
        ) VALUES (
          ${testOrgId},
          'report',
          gen_random_uuid(),
          '{"message": "Test report"}'::jsonb,
          'PENDING',
          now()
        ) RETURNING id;
      `
      createdNotificationIds.push(res.id)
    }
  })

  afterAll(async () => {
    if (createdNotificationIds.length > 0) {
      await sql`
        DELETE FROM public.outbox_notifications 
        WHERE id = ANY(${createdNotificationIds});
      `
    }
    await sql.end()
  })

  it('atomically partitions pending notifications between concurrent workers with SKIP LOCKED', async () => {
    // Uruchamiamy dwa równoległe wywołania pobierające po 5 rekordów
    const [batch1, batch2] = await Promise.all([
      sql`SELECT * FROM public.fetch_pending_outbox_notifications(5, 10);`,
      sql`SELECT * FROM public.fetch_pending_outbox_notifications(5, 10);`,
    ])

    const ids1 = new Set(batch1.map((r: any) => r.id))
    const ids2 = new Set(batch2.map((r: any) => r.id))

    // Sprawdzamy czy zbiory są rozłączne (brak duplikatów)
    for (const id of ids1) {
      expect(ids2.has(id)).toBe(false)
    }

    // Wszystkie pobrane wiersze powinny mieć status PROCESSING
    for (const row of [...batch1, ...batch2]) {
      expect(row.status).toBe('PROCESSING')
      expect(row.locked_at).not.toBeNull()
    }
  })

  it('correctly applies retry backoff on failure and marks FAILED after max attempts', async () => {
    const [inserted] = await sql`
      INSERT INTO public.outbox_notifications (
        organization_id,
        entity_type,
        entity_id,
        payload,
        status,
        attempts,
        max_attempts,
        next_retry_at
      ) VALUES (
        ${testOrgId},
        'report',
        gen_random_uuid(),
        '{"message": "Retry test"}'::jsonb,
        'PROCESSING',
        1,
        3,
        now()
      ) RETURNING id;
    `
    const notifId = inserted.id
    createdNotificationIds.push(notifId)

    // Symulacja błędu - próba 2 z 3
    await sql`
      SELECT public.handle_outbox_notification_attempt(
        ${notifId}::uuid,
        false,
        'Simulated gateway timeout'
      );
    `

    let [state] = await sql`SELECT * FROM public.outbox_notifications WHERE id = ${notifId};`
    expect(state.status).toBe('PENDING')
    expect(state.attempts).toBe(2)
    expect(state.last_error).toBe('Simulated gateway timeout')
    expect(new Date(state.next_retry_at).getTime()).toBeGreaterThan(Date.now())

    // Symulacja kolejnego błędu - próba 3 z 3 (wyczerpanie limitu)
    await sql`
      SELECT public.handle_outbox_notification_attempt(
        ${notifId}::uuid,
        false,
        'Final failure limit exceeded'
      );
    `

    ;[state] = await sql`SELECT * FROM public.outbox_notifications WHERE id = ${notifId};`
    expect(state.status).toBe('FAILED')
    expect(state.attempts).toBe(3)
    expect(state.last_error).toBe('Final failure limit exceeded')
  })
})
