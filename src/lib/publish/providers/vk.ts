import { inlineMediaForProxyPayload, parseFirstMediaUrl } from '@/lib/publish/parse-media-url'
import { sendPublishViaProxy } from '@/lib/publish/proxy-client'

type VkPublishInput = {
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

export async function publishToVk(input: VkPublishInput): Promise<{ success: true; externalId: string } | { success: false; error: string }> {
  const parsed = parseFirstMediaUrl(input.mediaUrls)
  const inline = inlineMediaForProxyPayload(parsed)

  const result = await sendPublishViaProxy({
    platform: 'vk',
    content: input.content,
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
    return { success: false, error: result.error ?? 'VK publish failed' }
  }
  return { success: true, externalId: result.externalId ?? `vk-${Date.now()}` }
}
