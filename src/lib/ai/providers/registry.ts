import { GigaChatProvider } from './gigachat-provider'
import type { AIProvider, AIProviderId } from './types'
import { VKAIProvider } from './vkai-provider'
import { YandexGPTProvider } from './yandexgpt-provider'

const defaultProviders: Record<AIProviderId, AIProvider> = {
  gigachat: new GigaChatProvider(),
  yandexgpt: new YandexGPTProvider(),
  vkai: new VKAIProvider(),
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
