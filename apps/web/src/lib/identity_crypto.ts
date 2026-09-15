import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const DEFAULT_SECRET = process.env.IDENTITY_ENCRYPTION_KEY || 'silvercare_identity_master_encryption_key_32b!!'

function getSecretKey(): Buffer {
  return crypto.createHash('sha256').update(DEFAULT_SECRET).digest()
}

export function maskNationalId(value: string): string {
  if (!value || value.length !== 11) return '•••••••••••'
  return value.slice(0, 6) + '•••••'
}

export function encryptNationalId(plainValue: string): string {
  const iv = crypto.randomBytes(12)
  const key = getSecretKey()
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  
  let encrypted = cipher.update(plainValue, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const authTag = cipher.getAuthTag().toString('hex')

  return `${iv.toString('hex')}:${authTag}:${encrypted}`
}

export function decryptNationalId(encryptedData: string): string {
  const [ivHex, authTagHex, encryptedHex] = encryptedData.split(':')
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('Nieprawidłowy format zaszyfrowanych danych identyfikatora.')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const key = getSecretKey()

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
