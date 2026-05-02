import { deepseekProvider } from './deepseek-provider'
import { GigaChatProvider } from './gigachat-provider'
import {
  AI_PROVIDER_ID_VALUES,
  type AIProvider,
  type AIProviderGenerateParams,
  type AIProviderGenerateResult,
  type AIProviderId,
  type AIProviderTokenEstimateParams,
} from './types'
import { YandexGPTProvider } from './yandexgpt-provider'
import { openrouterProvider } from './openrouter-provider'

/** Ordered fallback when the logical entry is `deepseek` (DeepSeek → GigaChat). */
export const AI_PROVIDER_FALLBACK_CHAIN: readonly AIProviderId[] = ['deepseek', 'gigachat']

class ProviderFallbackChain implements AIProvider {
  readonly id: AIProviderId

  constructor(
    readonly logicalId: AIProviderId,
    private readonly chain: readonly AIProvider[]
  ) {
    if (chain.length === 0) {
      throw new Error('AI provider fallback chain must not be empty')
    }
    this.id = logicalId
  }

  estimateTokens(params: AIProviderTokenEstimateParams): number {
    return this.chain[0]?.estimateTokens(params) ?? 0
  }

  async generate(params: AIProviderGenerateParams): Promise<AIProviderGenerateResult> {
    let lastError: unknown
    for (let i = 0; i < this.chain.length; i++) {
      const provider = this.chain[i]
      try {
        return await provider.generate(params)
      } catch (err) {
        lastError = err
        console.warn(
          `[AI] Provider "${provider.id}" is unavailable (${i + 1}/${this.chain.length}); continuing fallback chain.`,
          err
        )
      }
    }
    throw lastError instanceof Error ? lastError : new Error('All AI providers in the fallback chain failed')
  }

  async *stream(params: AIProviderGenerateParams): AsyncGenerator<string> {
    const result = await this.generate(params)
    yield result.content
  }
}

const gigachatProvider = new GigaChatProvider()

const defaultProviders: Record<AIProviderId, AIProvider> = {
  deepseek: new ProviderFallbackChain('deepseek', [deepseekProvider, gigachatProvider]),
  gigachat: gigachatProvider,
  yandexgpt: new YandexGPTProvider(),
  openrouter: openrouterProvider,
}

export class AIProviderRegistry {
  private readonly providers = new Map<AIProviderId, AIProvider>()

  constructor(initialProviders: Record<AIProviderId, AIProvider>) {
    for (const [id, provider] of Object.entries(initialProviders) as Array<[AIProviderId, AIProvider]>) {
      this.providers.set(id, provider)
    }
  }

  get(providerId: AIProviderId): AIProvider {
    const provider = this.providers.get(providerId)
    if (!provider) {
      throw new Error(`AI provider is not registered: ${providerId}`)
    }
    return provider
  }

  listIds(): AIProviderId[] {
    return Array.from(this.providers.keys())
  }
}

const providerRegistry = new AIProviderRegistry(defaultProviders)

export function getAIProvider(providerId: AIProviderId): AIProvider {
  return providerRegistry.get(providerId)
}

export const AI_PROVIDER_IDS: AIProviderId[] = providerRegistry.listIds()

export function resolveConfiguredDefaultProviderId(): AIProviderId {
  const raw = process.env.AI_DEFAULT_PROVIDER?.trim().toLowerCase()
  if (raw && (AI_PROVIDER_ID_VALUES as readonly string[]).includes(raw)) {
    return raw as AIProviderId
  }
  return 'deepseek'
}
