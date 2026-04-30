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
  const resolveChatId = (): string | null => {
    const metadataChatId = input.metadata.telegramChatId
    if (typeof metadataChatId === 'string' && metadataChatId.trim().length > 0) {
      return metadataChatId.trim()
    }

    const scopedChatId = input.credential?.scopes.find((scope) => scope.startsWith('chat_id:'))?.slice('chat_id:'.length)
    if (scopedChatId && scopedChatId.trim().length > 0) {
      return scopedChatId.trim()
    }

    const envChatId = process.env.TELEGRAM_CHAT_ID
    if (envChatId && envChatId.trim().length > 0) {
      return envChatId.trim()
    }

    return null
  }

  const tryDirectTelegramPublish = async (): Promise<{ success: true; externalId: string } | { success: false; error: string } | null> => {
    const publishMode = process.env.PUBLISH_MODE ?? 'sandbox'
    if (publishMode !== 'production') {
      return null
    }

    const botToken = input.credential?.accessToken?.trim()
    const chatId = resolveChatId()
    if (!botToken || !chatId) {
      return {
        success: false,
        error: !botToken
          ? 'Telegram bot token не найден в подключении платформы'
          : 'Telegram chat_id не задан. Укажите chat_id или @channel_username в подключении Telegram.',
      }
    }

    const endpoint = `https://api.telegram.org/bot${botToken}/${input.mediaUrls.length > 0 ? 'sendPhoto' : 'sendMessage'}`
    const body =
      input.mediaUrls.length > 0
        ? { chat_id: chatId, photo: input.mediaUrls[0], caption: input.content }
        : { chat_id: chatId, text: input.content }

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = (await response.json()) as { ok?: boolean; result?: { message_id?: number }; description?: string }
      if (!response.ok || !payload.ok) {
        return {
          success: false,
          error: payload.description ? `Telegram API error: ${payload.description}` : 'Telegram API request failed',
        }
      }
      return {
        success: true,
        externalId: String(payload.result?.message_id ?? `telegram-${Date.now()}`),
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Telegram direct publish failed'
      const causeCode =
        typeof error === 'object' &&
        error &&
        'cause' in error &&
        typeof (error as { cause?: { code?: unknown } }).cause?.code === 'string'
          ? (error as { cause?: { code?: string } }).cause?.code
          : undefined
      const causeMessage =
        typeof error === 'object' &&
        error &&
        'cause' in error &&
        typeof (error as { cause?: { message?: unknown } }).cause?.message === 'string'
          ? (error as { cause?: { message?: string } }).cause?.message
          : undefined
      return {
        success: false,
        error: [message, causeCode, causeMessage].filter(Boolean).join(' | '),
      }
    }
  }

  const directResult = await tryDirectTelegramPublish()
  if (directResult?.success) {
    return directResult
  }
  const directError = directResult?.error

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
    return {
      success: false,
      error: directError
        ? `Direct Telegram failed: ${directError}. Proxy fallback failed: ${result.error ?? 'unknown proxy error'}`
        : result.error ?? 'Telegram publish failed',
    }
  }
  return { success: true, externalId: result.externalId ?? `telegram-${Date.now()}` }
}
