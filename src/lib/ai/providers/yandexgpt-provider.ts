import type { AIProvider, AIProviderGenerateParams, AIProviderGenerateResult } from './types'

export class YandexGPTProvider implements AIProvider {
  readonly id = 'yandexgpt' as const

  estimateTokens(params: { prompt: string; maxTokens: number }): number {
    const promptTokens = Math.ceil(params.prompt.length / 4)
    return promptTokens + params.maxTokens
  }

  async generate(_params: AIProviderGenerateParams): Promise<AIProviderGenerateResult> {
    if (!process.env.YANDEX_GPT_API_KEY) {
      throw new Error('YandexGPT не настроен: задайте YANDEX_GPT_API_KEY')
    }

    throw new Error('YandexGPTProvider: базовая реализация еще не подключена к API')
  }
}
