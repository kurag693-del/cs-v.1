import type {
  AIProvider,
  AIProviderGenerateParams,
  AIProviderGenerateResult,
  AIProviderId,
  AIProviderTokenEstimateParams,
} from './types'

export type OpenAICompatibleProviderConfig = {
  baseURL: string
  model: string
  providerId: AIProviderId
  /** Static key or getter so keys from `process.env` are read at request time. */
  apiKey: string | (() => string)
}

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  model?: string
  error?: {
    message?: string
  }
}

export class AIProviderRequestError extends Error {
  readonly name = 'AIProviderRequestError'

  constructor(
    message: string,
    readonly status: number,
    readonly kind: 'invalid_key' | 'rate_limit' | 'server_error' | 'client_error'
  ) {
    super(message)
  }
}

function chatCompletionsUrl(baseURL: string): string {
  return `${baseURL.replace(/\/+$/, '')}/chat/completions`
}

function classifyHttpError(status: number): AIProviderRequestError['kind'] {
  if (status === 401 || status === 403) return 'invalid_key'
  if (status === 429) return 'rate_limit'
  if (status >= 500) return 'server_error'
  return 'client_error'
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly id: AIProviderId

  private readonly baseURL: string
  private readonly resolveApiKey: () => string
  private readonly model: string

  constructor(config: OpenAICompatibleProviderConfig) {
    this.id = config.providerId
    this.baseURL = config.baseURL
    if (typeof config.apiKey === 'function') {
      this.resolveApiKey = config.apiKey
    } else {
      const staticKey = config.apiKey
      this.resolveApiKey = () => staticKey
    }
    this.model = config.model
  }

  estimateTokens(params: AIProviderTokenEstimateParams): number {
    const promptTokens = Math.ceil(params.prompt.length / 4)
    return promptTokens + params.maxTokens
  }

  async generate(params: AIProviderGenerateParams): Promise<AIProviderGenerateResult> {
    const apiKey = this.resolveApiKey().trim()
    if (!apiKey) {
      throw new AIProviderRequestError('API key is not configured for this provider', 401, 'invalid_key')
    }

    const url = chatCompletionsUrl(this.baseURL)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: params.prompt }],
        temperature: params.temperature,
        max_tokens: params.maxTokens,
        response_mime_type: 'application/json',
      }),
    })

    if (!response.ok) {
      const bodyText = await response.text()
      const kind = classifyHttpError(response.status)
      throw new AIProviderRequestError(
        `OpenAI-compatible API error: ${response.status} ${bodyText.slice(0, 500)}`,
        response.status,
        kind
      )
    }

    const data = (await response.json()) as OpenAIChatCompletionResponse
    if (data.error?.message) {
      throw new AIProviderRequestError(data.error.message, 400, 'client_error')
    }

    const content = data.choices?.[0]?.message?.content?.trim()
    if (!content) {
      throw new AIProviderRequestError('Empty completion content', 502, 'server_error')
    }

    return {
      content,
      model: data.model ?? this.model,
      provider: this.id,
    }
  }

  async *stream(params: AIProviderGenerateParams): AsyncGenerator<string> {
    const single = await this.generate(params)
    yield single.content
  }
}
