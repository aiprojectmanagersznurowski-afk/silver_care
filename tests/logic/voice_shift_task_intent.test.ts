import { expect, it } from 'vitest'
import { extractNextShiftTaskIntents } from '../../apps/web/src/lib/voice-shift-task-intent'

it('proponuje zadanie tylko przy jawnej dyspozycji i zachowuje cytat @REQ: NUR-TASKS', () => {
  const quote = 'Na następną zmianę: przygotować świeże kubki.'
  expect(extractNextShiftTaskIntents(`Uzupełniono ręczniki. ${quote}`)).toEqual([
    { title: 'przygotować świeże kubki', quote },
  ])
  expect(extractNextShiftTaskIntents('Na następnej zmianie obecna będzie osoba z recepcji.')).toEqual([])
  expect(extractNextShiftTaskIntents('Bez spraw na następną zmianę.')).toEqual([])
})
