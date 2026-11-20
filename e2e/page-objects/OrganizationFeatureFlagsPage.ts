import { createHmac } from 'node:crypto'
import { expect, type Page } from '@playwright/test'
import { FEATURE_FLAGS_BY_KEY, type FeatureKey } from '../../packages/contracts/src/generated/features'

function totp(secret: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const bits = Array.from(secret.toUpperCase().replace(/=+$/, ''), (character) =>
    alphabet.indexOf(character).toString(2).padStart(5, '0')).join('')
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)))
  const hash = createHmac('sha1', key).update(counter).digest()
  return ((hash.readUInt32BE(hash.at(-1)! & 15) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0')
}

export class OrganizationFeatureFlagsPage {
  constructor(readonly page: Page) {}

  async open(organizationId: string) {
    await this.page.goto(`/admin/organizations/${organizationId}`)
  }

  toggle(key: FeatureKey) {
    return this.page.getByRole('switch', { name: FEATURE_FLAGS_BY_KEY[key].label, exact: true })
  }

  table(title: string) {
    return this.page.locator('[data-slot="table-card"]').filter({
      has: this.page.getByRole('heading', { name: title, exact: true }),
    })
  }

  async confirmMfa() {
    await this.page.getByRole('button', { name: 'Skonfiguruj uwierzytelnianie' }).click()
    const secret = this.page.getByTestId('feature-flags-totp-secret')
    await expect(secret).toBeVisible()
    await this.page.getByLabel('Kod uwierzytelniający').fill(totp((await secret.textContent())!.trim()))
    await this.page.getByRole('button', { name: 'Potwierdź kod' }).click()
    await expect(this.toggle('module_family_portal')).toBeEnabled()
  }

  async startPreview() {
    await this.page.locator('main [data-slot="row-actions"]').first().click()
    await this.page.getByRole('menuitem', { name: 'Zaloguj jako' }).click()
    await this.page.waitForURL('**/admin')
  }
}
