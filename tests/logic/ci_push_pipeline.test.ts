import { describe, it, expect } from 'vitest'
import { parseJobs, pushChainGaps, loadCiJobs } from '../../tools/ci-workflow-check.mjs'

/**
 * @REQ: INFRA-EU-REGION
 *
 * Regresja z 217d7275 (#343): zadanie `database` działa tylko dla pull requestów, więc na pushu
 * jest pominięte. Zadanie bez funkcji statusu w `if` dostaje od GitHub Actions niejawne `success()`
 * dla wszystkich przodków. Pominięty przodek pomija wtedy publikację, migracje stagingu i alias.
 * Każde zadanie uruchamiane na pushu, które ma `needs`, musi więc mieć `!cancelled()` (albo
 * `always()`) i jawnie sprawdzać wynik każdej bezpośredniej zależności.
 */

const regression = [
  'name: CI',
  'jobs:',
  '  database:',
  "    if: github.event_name == 'pull_request'",
  '  verify:',
  '    needs: database',
  '    if: ${{ !cancelled() }}',
  '  deploy:',
  '    needs: verify',
  "    if: ${{ github.event_name == 'push' }}",
  '  migrate_staging:',
  '    needs: deploy',
  "    if: ${{ github.event_name == 'push' }}",
  '  promote_staging:',
  '    needs: [deploy, migrate_staging]',
  "    if: ${{ github.event_name == 'push' }}",
].join('\n')

describe('CI: łańcuch zadań na pushu do staging i main (@REQ: INFRA-EU-REGION)', () => {
  it('@REQ: INFRA-EU-REGION - wykrywa układ z regresji 217d7275', () => {
    const gaps = pushChainGaps(parseJobs(regression))
    expect(gaps).toEqual(expect.arrayContaining([
      'deploy: brak !cancelled() albo always()',
      "deploy: brak needs.verify.result == 'success'",
      "promote_staging: brak needs.migrate_staging.result == 'success'",
    ]))
  })

  it('@REQ: INFRA-EU-REGION - przepuszcza zadania z funkcją statusu i jawnym wynikiem zależności', () => {
    const fixed = regression
      .replace("needs: verify\n    if: ${{ github.event_name == 'push' }}",
        "needs: verify\n    if: ${{ !cancelled() && needs.verify.result == 'success' && github.event_name == 'push' }}")
      .replace("needs: deploy\n    if: ${{ github.event_name == 'push' }}",
        "needs: deploy\n    if: ${{ !cancelled() && needs.deploy.result == 'success' && github.event_name == 'push' }}")
      .replace("needs: [deploy, migrate_staging]\n    if: ${{ github.event_name == 'push' }}",
        "needs: [deploy, migrate_staging]\n    if: ${{ !cancelled() && needs.deploy.result == 'success' && needs.migrate_staging.result == 'success' && github.event_name == 'push' }}")
    expect(pushChainGaps(parseJobs(fixed))).toEqual([])
  })

  it('@REQ: INFRA-EU-REGION - prawdziwy ci.yml nie ma luk w łańcuchu publikacji, migracji i aliasu', () => {
    const jobs = loadCiJobs()
    expect(jobs.map((job: { name: string }) => job.name))
      .toEqual(expect.arrayContaining(['database', 'verify', 'deploy', 'migrate_staging', 'promote_staging']))
    expect(pushChainGaps(jobs)).toEqual([])
  })

  it('@REQ: INFRA-EU-REGION - weryfikacja nadal działa także wtedy, gdy database jest pominięte', () => {
    const verify = loadCiJobs().find((job: { name: string }) => job.name === 'verify')
    expect(verify?.needs).toContain('database')
    expect(verify?.ifExpr).toContain('!cancelled()')
  })
})
