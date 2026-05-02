import { createHash, randomBytes } from 'node:crypto'

function requirePepper(): string {
  const pepper = process.env.WORKSPACE_INVITE_PEPPER ?? ''
  if (pepper.length < 16) {
    throw new Error(
      'WORKSPACE_INVITE_PEPPER не задан или короче 16 символов. Добавьте в .env.local (см. .env.local.example).'
    )
  }
  return pepper
}

/** Одноразовый секрет для ссылки; в БД сохраняется только hash. */
export function generateInviteSecret(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = hashInviteToken(rawToken)
  return { rawToken, tokenHash }
}

export function hashInviteToken(rawToken: string): string {
  const pepper = requirePepper()
  return createHash('sha256').update(`${pepper}:${rawToken}`, 'utf8').digest('hex')
}
