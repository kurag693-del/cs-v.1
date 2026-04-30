type PublishPlatform = 'telegram' | 'vk' | 'dzen'

type Env = {
  PUBLISH_PROXY_SECRET?: string
  PUBLISH_PROXY_MODE?: 'sandbox' | 'production'
}

type PublishPayload = {
  platform: PublishPlatform
  content: string
  mediaUrls?: string[]
  metadata?: Record<string, unknown>
}

type TelegramCredentialFromPayload = {
  accessToken?: string
  chatId?: string
  scopes?: string[]
}

type VkCredentialFromPayload = {
  accessToken?: string
  ownerId?: string
  scopes?: string[]
}

type DzenCredentialFromPayload = {
  accessToken?: string
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  })
}

async function publishToTelegram(env: Env, payload: PublishPayload) {
  const metadata = payload.metadata ?? {}
  const credential = (metadata.credential ?? {}) as TelegramCredentialFromPayload
  const scopedChatId =
    Array.isArray(credential.scopes) &&
    credential.scopes.find((scope) => typeof scope === 'string' && scope.startsWith('chat_id:'))?.slice('chat_id:'.length)

  const botToken = typeof credential.accessToken === 'string' && credential.accessToken.trim().length > 0 ? credential.accessToken.trim() : null
  const chatId =
    typeof metadata.telegramChatId === 'string' && metadata.telegramChatId.trim().length > 0
      ? metadata.telegramChatId.trim()
      : typeof credential.chatId === 'string' && credential.chatId.trim().length > 0
        ? credential.chatId.trim()
      : typeof scopedChatId === 'string' && scopedChatId.trim().length > 0
        ? scopedChatId.trim()
        : null

  if (!botToken || !chatId) {
    return { success: false as const, error: 'Telegram token/chat_id are missing in payload metadata (multi-tenant mode)' }
  }

  const firstMediaUrl = Array.isArray(payload.mediaUrls) ? payload.mediaUrls[0] : undefined
  const hasMedia = typeof firstMediaUrl === 'string' && /^https?:\/\//i.test(firstMediaUrl)
  const endpoint = `https://api.telegram.org/bot${botToken}/${hasMedia ? 'sendPhoto' : 'sendMessage'}`
  const body = hasMedia
    ? { chat_id: chatId, photo: firstMediaUrl, caption: payload.content }
    : { chat_id: chatId, text: payload.content }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await response.json()) as { ok?: boolean; result?: { message_id?: number } }
  if (!response.ok || !data?.ok) {
    return { success: false as const, error: `Telegram publish failed: ${JSON.stringify(data)}` }
  }

  return {
    success: true as const,
    externalId: String(data.result?.message_id ?? `tg-${Date.now()}`),
  }
}

async function publishToVk(payload: PublishPayload) {
  const metadata = payload.metadata ?? {}
  const credential = (metadata.credential ?? {}) as VkCredentialFromPayload
  const scopedOwnerId =
    Array.isArray(credential.scopes) &&
    credential.scopes.find((scope) => typeof scope === 'string' && scope.startsWith('owner_id:'))?.slice('owner_id:'.length)
  const token = typeof credential.accessToken === 'string' && credential.accessToken.trim().length > 0 ? credential.accessToken.trim() : null
  const ownerId =
    typeof metadata.vkOwnerId === 'string' && metadata.vkOwnerId.trim().length > 0
      ? metadata.vkOwnerId.trim()
      : typeof credential.ownerId === 'string' && credential.ownerId.trim().length > 0
        ? credential.ownerId.trim()
        : typeof scopedOwnerId === 'string' && scopedOwnerId.trim().length > 0
          ? scopedOwnerId.trim()
          : null

  if (!token || !ownerId) {
    return { success: false as const, error: 'VK token/owner_id are missing in payload metadata (multi-tenant mode)' }
  }

  const url = new URL('https://api.vk.com/method/wall.post')
  url.searchParams.set('owner_id', ownerId)
  url.searchParams.set('message', payload.content)
  url.searchParams.set('access_token', token)
  url.searchParams.set('v', '5.199')

  const response = await fetch(url, { method: 'GET' })
  const data = await response.json()
  if (!response.ok || (data as { error?: unknown }).error) {
    return { success: false as const, error: `VK publish failed: ${JSON.stringify(data)}` }
  }

  return {
    success: true as const,
    externalId: String((data as { response?: { post_id?: number } }).response?.post_id ?? `vk-${Date.now()}`),
  }
}

async function publishToDzen(payload: PublishPayload) {
  const metadata = payload.metadata ?? {}
  const credential = (metadata.credential ?? {}) as DzenCredentialFromPayload
  const token = typeof credential.accessToken === 'string' && credential.accessToken.trim().length > 0 ? credential.accessToken.trim() : null
  if (!token) {
    return { success: false as const, error: 'Dzen token is missing in payload metadata (multi-tenant mode)' }
  }
  return { success: true as const, externalId: `dzen-${Date.now()}` }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const mode = env.PUBLISH_PROXY_MODE ?? 'sandbox'
    const url = new URL(request.url)

    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ success: true, status: 'ok', mode })
    }

    if (request.method !== 'POST' || url.pathname !== '/publish') {
      return json({ success: false, error: 'Not found' }, 404)
    }

    const proxySecret = env.PUBLISH_PROXY_SECRET
    const headerSecret = request.headers.get('x-publish-proxy-secret')
    if (!proxySecret || headerSecret !== proxySecret) {
      return json({ success: false, error: 'Invalid proxy secret' }, 403)
    }

    let payload: PublishPayload
    try {
      payload = (await request.json()) as PublishPayload
    } catch {
      return json({ success: false, error: 'Invalid JSON body' }, 400)
    }

    if (!payload.platform || !payload.content) {
      return json({ success: false, error: 'platform and content are required' }, 400)
    }

    if (mode !== 'production') {
      return json({
        success: true,
        externalId: `sandbox-${payload.platform}-${Date.now()}`,
        sandbox: true,
      })
    }

    const result =
      payload.platform === 'telegram'
        ? await publishToTelegram(env, payload)
        : payload.platform === 'vk'
          ? await publishToVk(payload)
          : await publishToDzen(payload)

    if (!result.success) {
      return json({ success: false, error: result.error }, 502)
    }

    return json({
      success: true,
      externalId: result.externalId,
      sandbox: false,
    })
  },
}
