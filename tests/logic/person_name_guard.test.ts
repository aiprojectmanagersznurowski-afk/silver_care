import { describe, it, expect } from 'vitest'
import { checkWrite, kkConfig } from '../../tools/guard-core.mjs'

/**
 * @REQ: UI-TEMPLATE-ALIGNMENT
 *
 * „Nazwisko Imię” wyłącznie przez formatPersonName (lib/person-name). Reguła bramki nie pozwala składać
 * imienia i nazwiska ręcznie w kolejności „Imię Nazwisko” (decyzja Michała 2026-10-26).
 */
describe('Reguła bramki ui-hand-built-person-name (@REQ: UI-TEMPLATE-ALIGNMENT)', () => {
  const FILE = 'apps/web/src/components/Example.tsx'

  it('@REQ: UI-TEMPLATE-ALIGNMENT - reguła istnieje i jest blokująca', () => {
    const rule = kkConfig.forbiddenPatterns.find((p: { id: string }) => p.id === 'ui-hand-built-person-name')
    expect(rule).toBeDefined()
    expect(rule.severity).not.toBe('warn')
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - blokuje ręczne składanie imienia i nazwiska', () => {
    for (const code of [
      '<span>{r.first_name} {r.last_name}</span>',
      'title={`${resident.first_name} ${resident.last_name}`}',
      'alt={`${resident.first_name as string} ${resident.last_name as string}`}',
      "const n = `${a.residents?.first_name ?? ''} ${a.residents?.last_name ?? ''}`",
    ]) {
      const res = checkWrite(FILE, code)
      expect(res.blocked, code).toBe(true)
      expect(res.rule, code).toBe('ui-hand-built-person-name')
    }
  })

  it('@REQ: UI-TEMPLATE-ALIGNMENT - przepuszcza formatPersonName, sam helper i testy', () => {
    expect(checkWrite(FILE, '{formatPersonName(r.first_name, r.last_name)}').blocked).toBe(false)
    expect(checkWrite('apps/web/src/lib/person-name.ts', '`${first_name} ${last_name}`').blocked).toBe(false)
    expect(checkWrite('tests/logic/x.test.ts', '{r.first_name} {r.last_name}').blocked).toBe(false)
  })
})
