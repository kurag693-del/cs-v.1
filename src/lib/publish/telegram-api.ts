import type { ParsedFirstMedia } from '@/lib/publish/parse-media-url'

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

export async function sendTelegramDirectWithMedia(params: {
  botToken: string
  chatId: string
  caption: string
  firstMedia: ParsedFirstMedia
}): Promise<{ success: true; externalId: string } | { success: false; error: string }> {
  const { botToken, chatId, firstMedia } = params
  const caption = params.caption.length > TELEGRAM_CAPTION_MAX ? params.caption.slice(0, TELEGRAM_CAPTION_MAX) : params.caption

  if (firstMedia.kind === 'none') {
    const response = await fetch(telegramEndpoint(botToken, 'sendMessage'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: caption }),
    })
    const payload = (await response.json()) as { ok?: boolean; result?: { message_id?: number }; description?: string }
    if (!response.ok || !payload.ok) {
      return { success: false, error: payload.description ?? 'Telegram sendMessage failed' }
    }
    return { success: true, externalId: String(payload.result?.message_id ?? `tg-${Date.now()}`) }
  }

  if (firstMedia.kind === 'remote') {
    const method = 'sendPhoto'
    const body = { chat_id: chatId, photo: firstMedia.url, caption }
    const response = await fetch(telegramEndpoint(botToken, method), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = (await response.json()) as { ok?: boolean; result?: { message_id?: number }; description?: string }
    if (!response.ok || !payload.ok) {
      return { success: false, error: payload.description ?? 'Telegram sendPhoto(url) failed' }
    }
    return { success: true, externalId: String(payload.result?.message_id ?? `tg-${Date.now()}`) }
  }

  const method = pickTelegramMethod(firstMedia)
  const fieldName = method === 'sendPhoto' ? 'photo' : 'document'

  const blob = new Blob([new Uint8Array(firstMedia.buffer)], { type: firstMedia.mimeType })
  const form = new FormData()
  form.append('chat_id', chatId)
  form.append('caption', caption)
  form.append(fieldName, blob, firstMedia.filename)

  const response = await fetch(telegramEndpoint(botToken, method), {
    method: 'POST',
    body: form,
  })

  const payload = (await response.json()) as { ok?: boolean; result?: { message_id?: number }; description?: string }
  if (!response.ok || !payload.ok) {
    return { success: false, error: payload.description ?? `Telegram ${method} multipart failed` }
  }
  return { success: true, externalId: String(payload.result?.message_id ?? `tg-${Date.now()}`) }
}
