import type { ParsedFirstMedia } from '@/lib/publish/parse-media-url'
import { fetchTelegramApi } from '@/lib/publish/telegram-fetch'

function telegramEndpoint(token: string, method: string): string {
  return `https://api.telegram.org/bot${token}/${method}`
}

/** SVG и прочее без «фото» — как документ; JPEG/PNG/WebP/GIF — sendPhoto. */
function pickTelegramMethod(parsed: ParsedFirstMedia): 'sendPhoto' | 'sendDocument' {
  if (parsed.kind === 'data') {
    const m = parsed.mimeType.toLowerCase()
    if (m.includes('svg')) return 'sendDocument'
    if (m.startsWith('image/') && !m.includes('svg')) return 'sendPhoto'
    return 'sendDocument'
  }
  return 'sendPhoto'
}

const TELEGRAM_CAPTION_MAX = 1024

function mapTelegramNetworkError(err: unknown): string {
  if (!(err instanceof Error)) {
    return 'Ошибка сети при обращении к Telegram API'
  }
  const msg = err.message
  const cause = err.cause
  const code =
    cause && typeof cause === 'object' && 'code' in cause
      ? String((cause as { code?: string }).code ?? '')
      : ''

  if (
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_BODY_TIMEOUT' ||
    msg.includes('Connect Timeout') ||
    msg.includes('fetch failed')
  ) {
    return 'Таймаут при подключении или ответу от api.telegram.org. Проверьте сеть сервера и доступность Telegram API; при фильтрации трафика используйте HTTPS_PROXY или другой исходящий канал (переменные TELEGRAM_CONNECT_TIMEOUT_MS / TELEGRAM_BODY_TIMEOUT_MS см. .env.example).'
  }
  if (code === 'ECONNREFUSED' || msg.includes('ECONNREFUSED')) {
    return 'Подключение к api.telegram.org отклонено (ECONNREFUSED).'
  }
  if (code === 'ENOTFOUND' || msg.includes('ENOTFOUND')) {
    return 'Не удалось разрешить имя api.telegram.org (DNS).'
  }
  return `Сеть Telegram API: ${msg}`
}

type TelegramJsonPayload = { ok?: boolean; result?: { message_id?: number }; description?: string }

async function readTelegramResponse(response: Awaited<ReturnType<typeof fetchTelegramApi>>): Promise<TelegramJsonPayload> {
  try {
    return (await response.json()) as TelegramJsonPayload
  } catch {
    return { ok: false, description: `Некорректный ответ (HTTP ${response.status})` }
  }
}

export async function sendTelegramDirectWithMedia(params: {
  botToken: string
  chatId: string
  caption: string
  firstMedia: ParsedFirstMedia
}): Promise<{ success: true; externalId: string } | { success: false; error: string }> {
  const { botToken, chatId, firstMedia } = params
  const caption = params.caption.length > TELEGRAM_CAPTION_MAX ? params.caption.slice(0, TELEGRAM_CAPTION_MAX) : params.caption

  if (firstMedia.kind === 'none') {
    try {
      const response = await fetchTelegramApi(telegramEndpoint(botToken, 'sendMessage'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: caption }),
      })
      const payload = await readTelegramResponse(response)
      if (!response.ok || !payload.ok) {
        return { success: false, error: payload.description ?? 'Telegram sendMessage failed' }
      }
      return { success: true, externalId: String(payload.result?.message_id ?? `tg-${Date.now()}`) }
    } catch (err) {
      return { success: false, error: mapTelegramNetworkError(err) }
    }
  }

  if (firstMedia.kind === 'remote') {
    try {
      const method = 'sendPhoto'
      const body = { chat_id: chatId, photo: firstMedia.url, caption }
      const response = await fetchTelegramApi(telegramEndpoint(botToken, method), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const payload = await readTelegramResponse(response)
      if (!response.ok || !payload.ok) {
        return { success: false, error: payload.description ?? 'Telegram sendPhoto(url) failed' }
      }
      return { success: true, externalId: String(payload.result?.message_id ?? `tg-${Date.now()}`) }
    } catch (err) {
      return { success: false, error: mapTelegramNetworkError(err) }
    }
  }

  const method = pickTelegramMethod(firstMedia)
  const fieldName = method === 'sendPhoto' ? 'photo' : 'document'

  const blob = new Blob([new Uint8Array(firstMedia.buffer)], { type: firstMedia.mimeType })
  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('caption', caption)
  form.append(fieldName, blob, firstMedia.filename)

  try {
    const response = await fetchTelegramApi(telegramEndpoint(botToken, method), {
      method: 'POST',
      body: form,
    })
    const payload = await readTelegramResponse(response)
    if (!response.ok || !payload.ok) {
      return { success: false, error: payload.description ?? `Telegram ${method} multipart failed` }
    }
    return { success: true, externalId: String(payload.result?.message_id ?? `tg-${Date.now()}`) }
  } catch (err) {
    return { success: false, error: mapTelegramNetworkError(err) }
  }
}
