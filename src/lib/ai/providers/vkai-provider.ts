import type { AIProvider, AIProviderGenerateParams, AIProviderGenerateResult } from './types'

export class VKAIProvider implements AIProvider {
  readonly id = 'vkai' as const

  estimateTokens(params: { prompt: string; maxTokens: number }): number {
    const promptTokens = Math.ceil(params.prompt.length / 4)
    return promptTokens + params.maxTokens
  }

  async generate(_params: AIProviderGenerateParams): Promise<AIProviderGenerateResult> {
    if (!process.env.VK_AI_API_KEY) {
      throw new Error('VK AI не настроен: задайте VK_AI_API_KEY')
    }

    throw new Error('VKAIProvider: базовая реализация еще не подключена к API')
  }

  async *stream(params: AIProviderGenerateParams): AsyncGenerator<string> {
    const result = await this.generate(params)
    yield result.content
  }
}
