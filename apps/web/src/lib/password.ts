export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: 'Hasło musi mieć co najmniej 8 znaków.' }
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'Hasło musi zawierać co najmniej jedną wielką literę.' }
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'Hasło musi zawierać co najmniej jedną cyfrę.' }
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'Hasło musi zawierać co najmniej jeden znak specjalny.' }
  }
  return { valid: true }
}
