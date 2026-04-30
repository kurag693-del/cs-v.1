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

type DzenPublishSuccess = {
  success: true
  externalId: string
  fallbackUsed: boolean
  fallbackReason?: string
  markdown?: string
  exportHint?: string
  rssHint?: string
}

function buildDzenFallbackMarkdown(content: string, mediaUrls: string[]): string {
  const mediaSection =
    mediaUrls.length > 0
      ? `\n\n## Медиа\n${mediaUrls.map((url, index) => `${index + 1}. ${url}`).join('\n')}`
      : ''
  return `# Черновик для Дзена\n\n${content.trim()}${mediaSection}\n`
}

export async function publishToDzen(input: DzenPublishInput): Promise<DzenPublishSuccess | { success: false; error: string }> {
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
    const markdown = buildDzenFallbackMarkdown(input.content, input.mediaUrls)
    return {
      success: true,
      externalId: `dzen-fallback-${Date.now()}`,
      fallbackUsed: true,
      fallbackReason: result.error ?? 'Dzen API unavailable',
      markdown,
      exportHint: 'Откройте "Экспорт в Дзен" и загрузите Markdown вручную.',
      rssHint: 'Альтернатива: опубликуйте через RSS-импорт в Дзен.',
    }
  }
  return { success: true, externalId: result.externalId ?? `dzen-${Date.now()}`, fallbackUsed: false }
}
