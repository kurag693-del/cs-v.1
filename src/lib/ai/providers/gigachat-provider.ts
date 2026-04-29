import { randomUUID } from 'node:crypto'
import type { AIProvider, AIProviderGenerateParams, AIProviderGenerateResult } from './types'

type GigaChatTokenResponse = { access_token: string }
type GigaChatCompletionResponse = {
  model?: string
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

const GIGACHAT_BASE_URL = process.env.GIGACHAT_BASE_URL ?? 'https://gigachat.devices.sberbank.ru'
const GIGACHAT_AUTH_URL = process.env.GIGACHAT_AUTH_URL ?? 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth'
const GIGACHAT_SCOPE = process.env.GIGACHAT_SCOPE ?? 'GIGACHAT_API_PERS'
const GIGACHAT_MODEL = process.env.GIGACHAT_MODEL ?? 'GigaChat'
const GIGACHAT_ALLOW_SELF_SIGNED = process.env.GIGACHAT_ALLOW_SELF_SIGNED === 'true'

async function withOptionalSelfSignedTls<T>(callback: () => Promise<T>): Promise<T> {
  if (!GIGACHAT_ALLOW_SELF_SIGNED) {
    return callback()
  }

  const previous = process.env.NODE_TLS_REJECT_UNAUTHORIZED
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

  try {
    return await callback()
  } finally {
    if (previous === undefined) {
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = previous
    }
  }
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.GIGACHAT_CLIENT_ID ?? process.env.CLIENT_ID
  const clientSecret = process.env.GIGACHAT_CLIENT_SECRET ?? process.env.CLIENT_SECRET ?? process.env.Client_Secret
  const explicitAuthKey = process.env.GIGACHAT_AUTH_KEY
  const authKey =
    explicitAuthKey ??
    (clientId && clientSecret ? Buffer.from(`${clientId}:${clientSecret}`).toString('base64') : undefined)

  if (!authKey) {
    throw new Error('Не задана авторизация GigaChat')
  }

  const response = await withOptionalSelfSignedTls(() =>
    fetch(GIGACHAT_AUTH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        'User-Agent': 'CreativeStudio/1.0',
        RqUID: randomUUID(),
      },
      body: new URLSearchParams({ scope: GIGACHAT_SCOPE }),
    })
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Ошибка авторизации GigaChat: ${response.status} ${errorText}`)
  }

  const data = (await response.json()) as GigaChatTokenResponse
  if (!data.access_token) {
    throw new Error('GigaChat не вернул access_token')
  }
  return data.access_token
}

export class GigaChatProvider implements AIProvider {
  readonly id = 'gigachat' as const

  estimateTokens(params: { prompt: string; maxTokens: number }): number {
    const promptTokens = Math.ceil(params.prompt.length / 4)
    return promptTokens + params.maxTokens
  }

  async generate(params: AIProviderGenerateParams): Promise<AIProviderGenerateResult> {
    const accessToken = await getAccessToken()
    const response = await withOptionalSelfSignedTls(() =>
      fetch(`${GIGACHAT_BASE_URL}/api/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'CreativeStudio/1.0',
        },
        body: JSON.stringify({
          model: GIGACHAT_MODEL,
          stream: false,
          temperature: params.temperature,
          max_tokens: params.maxTokens,
          messages: [{ role: 'user', content: params.prompt }],
        }),
      })
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Ошибка запроса к GigaChat: ${response.status} ${errorText}`)
    }

    const data = (await response.json()) as GigaChatCompletionResponse
    const content = data.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('GigaChat вернул пустой ответ')
    }

    return {
      content,
      model: data.model ?? GIGACHAT_MODEL,
      provider: this.id,
    }
  }

  async *stream(params: AIProviderGenerateParams): AsyncGenerator<string> {
    const single = await this.generate(params)
    yield single.content
  }
}
