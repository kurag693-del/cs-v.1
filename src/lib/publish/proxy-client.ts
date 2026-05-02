type ProxyPublishResult = {
  success: boolean
  externalId?: string
  error?: string
}

type ProxyPublishPayload = {
  platform: 'telegram' | 'vk' | 'dzen'
  content: string
  mediaUrls: string[]
  /** Произвольные поля: publishInlineImage (base64), publishRemoteImageUrl, credential, … */
  metadata: Record<string, unknown>
}

export async function sendPublishViaProxy(payload: ProxyPublishPayload): Promise<ProxyPublishResult> {
  const publishMode = process.env.PUBLISH_MODE ?? 'sandbox'
  if (publishMode !== 'production') {
    return {
      success: true,
      externalId: `sandbox-${payload.platform}-${Date.now()}`,
    }
  }

  const proxyUrl = process.env.PUBLISH_PROXY_URL
  if (!proxyUrl) {
    return {
      success: false,
      error: 'PUBLISH_PROXY_URL is required in production mode',
    }
  }

  try {
    const proxySecret = process.env.PUBLISH_PROXY_SECRET
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(proxySecret ? { 'x-publish-proxy-secret': proxySecret } : {}),
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.text()
      return { success: false, error: `Proxy publish failed: ${response.status} ${body}` }
    }

    const body = (await response.json()) as { externalId?: string }
    return { success: true, externalId: body.externalId ?? `proxy-${payload.platform}-${Date.now()}` }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Proxy request failed',
    }
  }
}
