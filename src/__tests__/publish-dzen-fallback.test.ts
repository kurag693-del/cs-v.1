import { describe, expect, it } from 'vitest'

import { publishToDzen } from '@/lib/publish/providers/dzen'

describe('dzen publish fallback', () => {
  it('uses markdown export fallback when proxy is unavailable', async () => {
    process.env.PUBLISH_MODE = 'production'
    process.env.PUBLISH_PROXY_URL = 'http://127.0.0.1:1/unreachable'

    const result = await publishToDzen({
      content: 'Тестовый пост для Дзена',
      mediaUrls: ['https://example.com/image.jpg'],
      metadata: {},
      credential: {
        id: 'cred-1',
        accessToken: 'token',
        refreshToken: null,
        expiresAt: null,
        scopes: [],
        brandId: 'brand-1',
      },
    })

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.fallbackUsed).toBe(true)
    expect(result.externalId).toContain('dzen-fallback-')
    expect(result.markdown).toContain('# Черновик для Дзена')
    expect(result.exportHint).toContain('Экспорт в Дзен')
    expect(result.rssHint).toContain('RSS')
  })
})
