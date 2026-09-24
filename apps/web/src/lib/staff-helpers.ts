import crypto from 'node:crypto'

export function validateDeactivationConfirmation(input: string): boolean {
  return (input || '').trim() === 'DEZAKTYWUJ'
}

/**
 * Kryptograficznie bezpieczny generator haseł tymczasowych.
 * Gwarantuje spełnienie reguł złożoności: wielka litera, mała litera, cyfra, znak specjalny.
 */
export function generateSecureTemporaryPassword(length: number = 16): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const lower = 'abcdefghijkmnopqrstuvwxyz'
  const numbers = '23456789'
  const special = '!@#$%^&*'

  const allChars = upper + lower + numbers + special

  // Gwarantuj co najmniej jeden znak z każdej kategorii
  const mandatory = [
    upper[crypto.randomInt(0, upper.length)],
    lower[crypto.randomInt(0, lower.length)],
    numbers[crypto.randomInt(0, numbers.length)],
    special[crypto.randomInt(0, special.length)],
  ]

  const remainingLength = Math.max(0, length - mandatory.length)
  const randomChars: string[] = []

  for (let i = 0; i < remainingLength; i++) {
    randomChars.push(allChars[crypto.randomInt(0, allChars.length)])
  }

  // Wymieszaj znaki algorytmem Fisher-Yates z krypto-losowością
  const combined = [...mandatory, ...randomChars]
  for (let i = combined.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1)
    const temp = combined[i]
    combined[i] = combined[j]
    combined[j] = temp
  }

  return combined.join('')
}

export function generateTemporaryPassword(): string {
  return generateSecureTemporaryPassword(16)
}
