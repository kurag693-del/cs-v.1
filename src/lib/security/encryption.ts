import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'

function getKey(): Buffer {
  const secret = process.env.PUBLISH_TOKEN_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('PUBLISH_TOKEN_ENCRYPTION_KEY is not configured')
  }
  return createHash('sha256').update(secret).digest()
}

export function encryptSecret(plainText: string): string {
  const iv = randomBytes(12)
  const key = getKey()
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

export function decryptSecret(encryptedPayload: string): string {
  const [ivB64, tagB64, cipherB64] = encryptedPayload.split(':')
  if (!ivB64 || !tagB64 || !cipherB64) {
    throw new Error('Invalid encrypted payload format')
  }

  const iv = Buffer.from(ivB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const encrypted = Buffer.from(cipherB64, 'base64')
  const key = getKey()

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}
