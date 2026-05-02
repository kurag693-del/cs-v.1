import { inlineMediaForProxyPayload, parseFirstMediaUrl } from '@/lib/publish/parse-media-url'
import { sendPublishViaProxy } from '@/lib/publish/proxy-client'
import { sendTelegramDirectWithMedia } from '@/lib/publish/telegram-api'

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

    const firstMedia = parseFirstMediaUrl(input.mediaUrls)
    const result = await sendTelegramDirectWithMedia({
      botToken,
      chatId,
      caption: input.content,
      firstMedia,
    })
    return result
  }

  const directResult = await tryDirectTelegramPublish()
  if (directResult?.success) {
    return directResult
  }
  const directError = directResult && !directResult.success ? directResult.error : undefined

  const escaped = input.content
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')

  const parsed = parseFirstMediaUrl(input.mediaUrls)
  const inline = inlineMediaForProxyPayload(parsed)

  const result = await sendPublishViaProxy({
    platform: 'telegram',
    content: escaped,
    mediaUrls: input.mediaUrls,
    metadata: {
      ...input.metadata,
      ...(inline
        ? {
            publishInlineImage: {
              base64: inline.inlineBase64,
              mimeType: inline.mimeType,
              filename: inline.filename,
            },
          }
        : parsed.kind === 'remote'
          ? { publishRemoteImageUrl: parsed.url }
          : {}),
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
