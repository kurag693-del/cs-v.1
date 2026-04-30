import { sendPublishViaProxy } from '@/lib/publish/proxy-client'

type DzenPublishInput = {
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

export async function publishToDzen(input: DzenPublishInput): Promise<{ success: true; externalId: string } | { success: false; error: string }> {
  const result = await sendPublishViaProxy({
    platform: 'dzen',
    content: input.content,
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
    return { success: false, error: result.error ?? 'Dzen publish failed' }
  }
  return { success: true, externalId: result.externalId ?? `dzen-${Date.now()}` }
}
