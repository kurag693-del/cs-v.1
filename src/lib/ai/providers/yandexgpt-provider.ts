import type { AIProvider, AIProviderGenerateParams, AIProviderGenerateResult } from './types'

type YandexMessage = { role: 'system' | 'assistant' | 'user'; text: string }
type YandexCompletionResponse = {
  result?: {
    alternatives?: Array<{
      message?: {
        text?: string
      }
    }>
    modelVersion?: string
  }
}

export class YandexGPTProvider implements AIProvider {
  readonly id = 'yandexgpt' as const

  estimateTokens(params: { prompt: string; maxTokens: number }): number {
    const promptTokens = Math.ceil(params.prompt.length / 4)
    return promptTokens + params.maxTokens
  }

  async generate(_params: AIProviderGenerateParams): Promise<AIProviderGenerateResult> {
    const apiKey = process.env.YANDEX_GPT_API_KEY
    const folderId = process.env.YANDEX_GPT_FOLDER_ID
    const modelUri = process.env.YANDEX_GPT_MODEL_URI ?? (folderId ? `gpt://${folderId}/yandexgpt-lite/latest` : null)

    if (!apiKey || !modelUri) {
      throw new Error('YandexGPT не настроен: задайте YANDEX_GPT_API_KEY')
    }

    const payload = {
      modelUri,
      completionOptions: {
        stream: false,
        temperature: _params.temperature,
        maxTokens: String(_params.maxTokens),
      },
      messages: [{ role: 'user', text: _params.prompt }] satisfies YandexMessage[],
    }

    const response = await fetch('https://llm.api.cloud.yandex.net/foundationModels/v1/completion', {
      method: 'POST',
      headers: {
        Authorization: `Api-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`YandexGPT API error: ${response.status} ${errorText}`)
    }

    const data = (await response.json()) as YandexCompletionResponse
    const content = data.result?.alternatives?.[0]?.message?.text?.trim()
    if (!content) {
      throw new Error('YandexGPT вернул пустой ответ')
    }

    return {
      content,
      model: data.result?.modelVersion ?? 'yandexgpt-lite',
      provider: this.id,
    }
  }
}
