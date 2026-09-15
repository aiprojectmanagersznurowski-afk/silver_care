export function validateDeactivationConfirmation(input: string): boolean {
  return (input || '').trim() === 'DEZAKTYWUJ'
}

export function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*'
  let pass = 'Sc1!'
  for (let i = 0; i < 8; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return pass
}
