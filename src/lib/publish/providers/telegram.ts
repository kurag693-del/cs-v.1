import { sendPublishViaProxy } from '@/lib/publish/proxy-client'

type TelegramPublishInput = {
  content: string
  mediaUrls: string[]
  metadata: Record<string, unknown>
  credential?: {
    id: string
    accessToken: string
    refreshToken: string | null
    expiresAt: Date | null
    scopes: string[]
    brandId: string
  } | null
}

export async function publishToTelegram(input: TelegramPublishInput): Promise<{ success: true; externalId: string } | { success: false; error: string }> {
  const escaped = input.content
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')

  const result = await sendPublishViaProxy({
    platform: 'telegram',
    content: escaped,
    mediaUrls: input.mediaUrls,
    metadata: {
      ...input.metadata,
      credential: input.credential
        ? {
            id: input.credential.id,
            accessToken: input.credential.accessToken,
            refreshToken: input.credential.refreshToken,
            expiresAt: input.credential.expiresAt?.toISOString() ?? null,
            scopes: input.credential.scopes,
            brandId: input.credential.brandId,
          }
        : null,
    },
  })

  if (!result.success) {
    return { success: false, error: result.error ?? 'Telegram publish failed' }
  }
  return { success: true, externalId: result.externalId ?? `telegram-${Date.now()}` }
}
