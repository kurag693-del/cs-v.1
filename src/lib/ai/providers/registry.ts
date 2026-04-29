import { GigaChatProvider } from './gigachat-provider'
import type { AIProvider, AIProviderId } from './types'
import { VKAIProvider } from './vkai-provider'
import { YandexGPTProvider } from './yandexgpt-provider'

const providerRegistry: Record<AIProviderId, AIProvider> = {
  gigachat: new GigaChatProvider(),
  yandexgpt: new YandexGPTProvider(),
  vkai: new VKAIProvider(),
}

export function getAIProvider(providerId: AIProviderId): AIProvider {
  return providerRegistry[providerId]
}

export const AI_PROVIDER_IDS: AIProviderId[] = ['gigachat', 'yandexgpt', 'vkai']
