import type { AIProvider, AIProviderGenerateParams, AIProviderGenerateResult } from './types'

type VkCompletionResponse = {
  result?: {
    alternatives?: Array<{
      text?: string
      message?: {
        text?: string
      }
    }>
    modelVersion?: string
  }
}

export class VKAIProvider implements AIProvider {
  readonly id = 'vkai' as const

  estimateTokens(params: { prompt: string; maxTokens: number }): number {
    const promptTokens = Math.ceil(params.prompt.length / 4)
    return promptTokens + params.maxTokens
  }

  async generate(_params: AIProviderGenerateParams): Promise<AIProviderGenerateResult> {
    const apiKey = process.env.VK_AI_API_KEY
    const model = process.env.VK_AI_MODEL ?? 'vk-gpt-lite'
    const endpoint = process.env.VK_AI_ENDPOINT ?? 'https://llm.api.cloud.ru/foundationModels/v1/completion'

    if (!apiKey) {
      throw new Error('VK AI не настроен: задайте VK_AI_API_KEY')
    }

    const payload = {
      model,
      stream: false,
      temperature: _params.temperature,
      max_tokens: _params.maxTokens,
      messages: [{ role: 'user', content: _params.prompt }],
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`VK AI API error: ${response.status} ${errorText}`)
    }

    const data = (await response.json()) as VkCompletionResponse
    const content = data.result?.alternatives?.[0]?.message?.text?.trim() ?? data.result?.alternatives?.[0]?.text?.trim()
    if (!content) {
      throw new Error('VK AI вернул пустой ответ')
    }

    return {
      content,
      model: data.result?.modelVersion ?? model,
      provider: this.id,
    }
  }

  async *stream(params: AIProviderGenerateParams): AsyncGenerator<string> {
    const result = await this.generate(params)
    yield result.content
  }
}
