import { createHmac } from 'crypto'

/**
 * Jedyne miejsce, w którym liczony jest hash numeru PESEL (SEC-PESEL-HASH).
 * Sól pochodzi wyłącznie ze zmiennej środowiskowej — nie leży w kodzie ani w rekordzie.
 * Brak soli kończy się błędem, nie wartością domyślną: hash z jawną solą da się odwrócić słownikiem.
 */
export function hashNationalId(value: string): string {
  const salt = process.env.PESEL_HASH_SALT
  if (!salt) {
    throw new Error('[SEC-PESEL-HASH] Brak PESEL_HASH_SALT w konfiguracji serwera.')
  }
  return createHmac('sha256', salt).update(value).digest('hex')
}
