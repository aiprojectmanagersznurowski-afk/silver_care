import { describe, it, expect } from 'vitest'
import { checkWrite, kkConfig } from '../../tools/guard-core.mjs'

/**
 * @REQ: SUP-IAM-PANEL
 * Dawne role (admin, facility_manager, caregiver, paramedic) usunięte 2026-10-26 (decyzja Michała).
 * Reguła bramki nie pozwala ich przywrócić w kodzie aplikacji. Role mieszkają w kontrakcie (ROLES).
 */
describe('Reguła bramki auth-legacy-role (@REQ: SUP-IAM-PANEL)', () => {
  const FILE = 'apps/web/src/actions/example.ts'

  it('@REQ: SUP-IAM-PANEL - reguła istnieje i jest blokująca', () => {
    const rule = kkConfig.forbiddenPatterns.find((p: { id: string }) => p.id === 'auth-legacy-role')
    expect(rule).toBeDefined()
    expect(rule.severity).not.toBe('warn')
  })

  it('@REQ: SUP-IAM-PANEL - blokuje porównania i listy z dawnymi rolami', () => {
    for (const code of [
      "if (role === 'admin') {}",
      "if (appRole !== 'facility_manager') {}",
      "const STAFF = ['nurse', 'caregiver']",
      "const ok = ['org_admin', 'admin'].includes(role)",
      "const ok = ['org_admin', 'super_admin', 'admin'].includes(role)",
      "targetAppMeta.role !== 'paramedic'",
    ]) {
      const res = checkWrite(FILE, code)
      expect(res.blocked, code).toBe(true)
      expect(res.rule, code).toBe('auth-legacy-role')
    }
  })

  it('@REQ: SUP-IAM-PANEL - przepuszcza role z kontraktu, ścieżki /admin i testy', () => {
    expect(checkWrite(FILE, "if (role === 'org_admin' || role === 'super_admin') {}").blocked).toBe(false)
    expect(checkWrite(FILE, "redirect('/admin')").blocked).toBe(false)
    expect(checkWrite(FILE, "const roles = ['nurse', 'org_admin']").blocked).toBe(false)
    expect(checkWrite('tests/logic/x.test.ts', "role === 'caregiver'").blocked).toBe(false)
  })
})
