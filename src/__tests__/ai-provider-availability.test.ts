import { afterEach, describe, expect, it, vi } from 'vitest'

describe('AI provider availability', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('lists only providers with env configured', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test')
    vi.stubEnv('YANDEX_GPT_API_KEY', '')
    vi.stubEnv('GIGACHAT_AUTH_KEY', '')

    const { getConfiguredAIProviderIds } = await import('@/lib/ai/providers/availability')
    expect(getConfiguredAIProviderIds()).toEqual(['deepseek'])
  })

  it('includes Yandex when key and folder are set', async () => {
    vi.stubEnv('DEEPSEEK_API_KEY', '')
    vi.stubEnv('YANDEX_GPT_API_KEY', 'key')
    vi.stubEnv('YANDEX_GPT_FOLDER_ID', 'folder')

    const { getConfiguredAIProviderIds } = await import('@/lib/ai/providers/availability')
    expect(getConfiguredAIProviderIds()).toContain('yandexgpt')
  })
})
