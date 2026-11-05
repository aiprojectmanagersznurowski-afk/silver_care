import { describe, it, expect, vi } from 'vitest'
import { summarizeResidentTasks, RECENT_DONE_DAYS } from '../../apps/web/src/lib/resident-card/resident-tasks'
import { getResidentCard } from '../../apps/web/src/lib/resident-card/get-resident-card'

/**
 * @REQ: ADM-RESIDENT-CARD-TASKS
 *
 * SC-ADM-21 (AC1, AC5): sekcja „Zadania” na karcie podopiecznego — otwarte zadania (propozycje i do zrobienia),
 * wykonane z ostatnich 7 dni, źródło i przypisanie widoczne. Znacznik „wymaga uwagi” włącza tylko otwarte
 * zadanie zaakceptowane przez człowieka (TODO), nie propozycja, i gaśnie po rozliczeniu.
 */

const NOW = new Date('2026-11-10T12:00:00Z')

type Row = Parameters<typeof summarizeResidentTasks>[0][number]

const row = (over: Partial<Row>): Row => ({
  id: 't1',
  title: 'Zadanie',
  due_time: null,
  shift_date: '2026-11-10',
  source: 'MANUAL',
  status: 'TODO',
  carried_from_task_id: null,
  assignee_user_id: null,
  settled_at: null,
  shift_definitions: { name: 'Dzienna' },
  ...over,
})

describe('summarizeResidentTasks (@REQ: ADM-RESIDENT-CARD-TASKS)', () => {
  it('@REQ: ADM-RESIDENT-CARD-TASKS - otwarte to propozycje i zadania do zrobienia, chronologicznie; bez anulowanych', () => {
    const s = summarizeResidentTasks([
      row({ id: 'a', title: 'Późniejsze', shift_date: '2026-11-11', due_time: '08:00' }),
      row({ id: 'b', title: 'Wieczorem', due_time: '18:00' }),
      row({ id: 'c', title: 'Propozycja', status: 'PROPOSED', due_time: '09:00' }),
      row({ id: 'd', title: 'Anulowane', status: 'CANCELLED', settled_at: '2026-11-10T08:00:00Z' }),
    ], NOW)
    expect(s.open.map((t) => t.title)).toEqual(['Propozycja', 'Wieczorem', 'Późniejsze'])
    expect(s.open.map((t) => t.statusLabel)).toEqual(['Propozycja', 'Do zrobienia', 'Do zrobienia'])
    expect([...s.open, ...s.recentDone].some((t) => t.title === 'Anulowane')).toBe(false)
  })

  it('@REQ: ADM-RESIDENT-CARD-TASKS - zadanie przeniesione na kolejną zmianę widać raz: jako kopię z oznaczeniem źródła', () => {
    const s = summarizeResidentTasks([
      row({ id: 'orig', title: 'Zmierzyć płyny', shift_date: '2026-11-09' }),
      row({ id: 'copy', title: 'Zmierzyć płyny', carried_from_task_id: 'orig' }),
    ], NOW)
    expect(s.open.map((t) => t.id)).toEqual(['copy'])
    expect(s.open[0].sourceLabel).toBe('Przeniesione z poprzedniej zmiany')
  })

  it(`@REQ: ADM-RESIDENT-CARD-TASKS - wykonane tylko z ostatnich ${RECENT_DONE_DAYS} dni, najnowsze pierwsze`, () => {
    const s = summarizeResidentTasks([
      row({ id: 'old', title: 'Stare', status: 'DONE', settled_at: '2026-11-02T11:00:00Z' }),
      row({ id: 'd1', title: 'Wczoraj', status: 'DONE', settled_at: '2026-11-09T10:00:00Z' }),
      row({ id: 'd2', title: 'Dziś', status: 'DONE', settled_at: '2026-11-10T09:00:00Z' }),
      row({ id: 'edge', title: 'Równo tydzień', status: 'DONE', settled_at: '2026-11-03T12:00:00Z' }),
    ], NOW)
    expect(s.recentDone.map((t) => t.title)).toEqual(['Dziś', 'Wczoraj', 'Równo tydzień'])
  })

  it('@REQ: ADM-RESIDENT-CARD-TASKS - źródło, przypisanie i zmiana widoczne jako fakty', () => {
    const [plan, handover, person, noShift] = summarizeResidentTasks([
      row({ id: '1', source: 'CARE_PLAN', due_time: '07:00' }),
      row({ id: '2', source: 'HANDOVER', due_time: '08:00' }),
      row({ id: '3', assignee_user_id: 'u9', due_time: '09:00' }),
      row({ id: '4', shift_definitions: null, due_time: '10:00' }),
    ], NOW).open
    expect(plan.sourceLabel).toBe('Z planu opieki')
    expect(handover.sourceLabel).toBe('Z przekazania')
    expect(plan.assigneeLabel).toBe('Cała zmiana')
    expect(person.assigneeLabel).toBe('Przypisane do osoby')
    expect(plan.shiftName).toBe('Dzienna')
    expect(noShift.shiftName).toBeNull()
  })

  it('@REQ: ADM-RESIDENT-CARD-TASKS - „wymaga uwagi” tylko przy otwartym zadaniu do zrobienia; propozycja go nie włącza', () => {
    expect(summarizeResidentTasks([row({ status: 'TODO' })], NOW).needsAttention).toBe(true)
    expect(summarizeResidentTasks([row({ status: 'PROPOSED' })], NOW).needsAttention).toBe(false)
    expect(summarizeResidentTasks([], NOW).needsAttention).toBe(false)
  })

  it('@REQ: ADM-RESIDENT-CARD-TASKS - „wymaga uwagi” gaśnie po rozliczeniu (wykonane, anulowane, przeniesione)', () => {
    const settled = summarizeResidentTasks([
      row({ id: 'x', status: 'DONE', settled_at: '2026-11-10T08:00:00Z' }),
      row({ id: 'y', status: 'CANCELLED', settled_at: '2026-11-10T08:00:00Z' }),
    ], NOW)
    expect(settled.needsAttention).toBe(false)
    // Przeniesienie zostawia oryginał jako TODO, ale znacznik wynika z kopii na kolejnej zmianie
    const carried = summarizeResidentTasks([row({ id: 'orig' }), row({ id: 'copy', status: 'PROPOSED', carried_from_task_id: 'orig' })], NOW)
    expect(carried.needsAttention).toBe(false)
  })
})

type Call = { table: string; method: string; args: unknown[] }
type Result = { data: unknown; error: { code: string; message: string } | null }

function mockSupabase(results: Partial<Record<string, Result>> = {}) {
  const calls: Call[] = []
  const from = vi.fn((table: string) => {
    const b: Record<string, unknown> = {}
    for (const method of ['select', 'eq', 'order', 'limit', 'maybeSingle']) {
      b[method] = (...args: unknown[]) => {
        calls.push({ table, method, args })
        return b
      }
    }
    b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
      Promise.resolve(results[table] ?? { data: table === 'residents' ? { id: 'r1', first_name: 'Jan', last_name: 'Kowalski' } : [], error: null }).then(res, rej)
    return b
  })
  return { client: { from } as never, calls, from }
}

const user = (appMetadata: Record<string, unknown>) => ({ id: 'u1', app_metadata: appMetadata, user_metadata: {} }) as never

describe('getResidentCard — sekcja „Zadania” (@REQ: ADM-RESIDENT-CARD-TASKS)', () => {
  it('@REQ: ADM-RESIDENT-CARD-TASKS - pielęgniarka i kierownik: zadania tego podopiecznego z tej placówki', async () => {
    for (const role of ['nurse', 'org_admin']) {
      const { client, calls } = mockSupabase({
        shift_tasks: { data: [row({ id: 'k1', title: 'Zmierzyć płyny' })], error: null },
      })
      const card = await getResidentCard(client, 'r1', user({ role, organization_id: 'o1' }), false)
      expect(card.status, role).toBe('ok')
      const eqs = calls.filter((c) => c.table === 'shift_tasks' && c.method === 'eq').map((c) => c.args)
      expect(eqs).toContainEqual(['resident_id', 'r1'])
      expect(eqs).toContainEqual(['organization_id', 'o1'])
      if (card.status === 'ok') {
        expect(card.tasks?.open.map((t) => t.title)).toEqual(['Zmierzyć płyny'])
        expect(card.tasks?.needsAttention).toBe(true)
      }
    }
  })

  it('@REQ: ADM-RESIDENT-CARD-TASKS - lista kolumn zadań jawna, bez „*” i bez cytatu źródłowego', async () => {
    const { client, calls } = mockSupabase()
    await getResidentCard(client, 'r1', user({ role: 'nurse', organization_id: 'o1' }), false)
    const select = String(calls.find((c) => c.table === 'shift_tasks' && c.method === 'select')?.args[0] ?? '')
    expect(select).toContain('status')
    expect(select).not.toMatch(/(^|[\s,(])\*/)
    expect(select).not.toContain('source_quote')
  })

  it('@REQ: ADM-RESIDENT-CARD-TASKS - rodzina i opiekun prawny: odmowa bez zapytania o zadania', async () => {
    for (const role of ['family', 'legal_guardian']) {
      const { client, from } = mockSupabase()
      expect((await getResidentCard(client, 'r1', user({ role }), false)).status).toBe('forbidden')
      expect(from).not.toHaveBeenCalledWith('shift_tasks')
    }
  })

  it('@REQ: ADM-RESIDENT-CARD-TASKS - błąd zapytania o zadania to błąd karty bez treści w logu', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { client } = mockSupabase({ shift_tasks: { data: null, error: { code: '42501', message: 'Zmierzyć płyny Kowalski' } } })
    expect(await getResidentCard(client, 'r1', user({ role: 'nurse', organization_id: 'o1' }), false)).toEqual({ status: 'error' })
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/Kowalski|płyny/)
    spy.mockRestore()
  })
})
