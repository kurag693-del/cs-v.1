import type {
  AIProvider,
  AIProviderGenerateParams,
  AIProviderGenerateResult,
  AIProviderId,
  AIProviderTokenEstimateParams,
} from './types'

export type OpenAICompatibleProviderConfig = {
  baseURL: string
  model: string | (() => string)
  providerId: AIProviderId
  /** Static key or getter so keys from `process.env` are read at request time. */
  apiKey: string | (() => string)
  /** OpenRouter требует HTTP-Referer и X-Title; другие совместимые API могут игнорировать. */
  extraHeaders?: Record<string, string> | (() => Record<string, string>)
}

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null
    }
  }>
  model?: string
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
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
  private readonly resolveModel: () => string
  private readonly resolveExtraHeaders: (() => Record<string, string>) | undefined

  constructor(config: OpenAICompatibleProviderConfig) {
    this.id = config.providerId
    this.baseURL = config.baseURL
    if (typeof config.apiKey === 'function') {
      this.resolveApiKey = config.apiKey
    } else {
      const staticKey = config.apiKey
      this.resolveApiKey = () => staticKey
    }
    if (typeof config.model === 'function') {
      this.resolveModel = config.model
    } else {
      const staticModel = config.model
      this.resolveModel = () => staticModel
    }
    if (config.extraHeaders) {
      if (typeof config.extraHeaders === 'function') {
        this.resolveExtraHeaders = config.extraHeaders
      } else {
        const h = config.extraHeaders
        this.resolveExtraHeaders = () => h
      }
    } else {
      this.resolveExtraHeaders = undefined
    }
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
    const model = params.model?.trim() || this.resolveModel()
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    }
    const extra = this.resolveExtraHeaders?.()
    if (extra) {
      Object.assign(headers, extra)
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: params.prompt }],
        temperature: params.temperature,
        max_tokens: params.maxTokens,
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

    const u = data.usage
    const usage =
      u && (u.total_tokens != null || u.prompt_tokens != null || u.completion_tokens != null)
        ? {
            promptTokens: Math.max(0, u.prompt_tokens ?? 0),
            completionTokens: Math.max(0, u.completion_tokens ?? 0),
            totalTokens: Math.max(
              0,
              u.total_tokens ?? (u.prompt_tokens ?? 0) + (u.completion_tokens ?? 0)
            ),
          }
        : undefined

    return {
      content,
      model: data.model ?? model,
      provider: this.id,
      usage,
    }
  }

  async *stream(params: AIProviderGenerateParams): AsyncGenerator<string> {
    const single = await this.generate(params)
    yield single.content
  }
}
