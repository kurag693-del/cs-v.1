import { resolveConfiguredDefaultProviderId } from './registry'
import { AI_PROVIDER_ID_VALUES, type AIProviderId } from './types'

function normalizeEnv(value?: string): string | undefined {
  if (!value) return undefined
  return value.trim().replace(/^['"]|['"]$/g, '')
}

export function isDeepseekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim())
}

export function isGigaChatConfigured(): boolean {
  const explicitAuthKeyRaw = normalizeEnv(process.env.GIGACHAT_AUTH_KEY)
  const explicitAuthKey = explicitAuthKeyRaw?.replace(/^Basic\s+/i, '').trim()
  if (explicitAuthKey && explicitAuthKey.length > 0) return true
  const clientId = normalizeEnv(process.env.GIGACHAT_CLIENT_ID ?? process.env.CLIENT_ID)
  const clientSecret = normalizeEnv(
    process.env.GIGACHAT_CLIENT_SECRET ?? process.env.CLIENT_SECRET ?? process.env.Client_Secret
  )
  return Boolean(clientId && clientSecret)
}

export function isYandexGptConfigured(): boolean {
  const apiKey = process.env.YANDEX_GPT_API_KEY?.trim()
  if (!apiKey) return false
  const folderId = process.env.YANDEX_GPT_FOLDER_ID?.trim()
  const modelUri = process.env.YANDEX_GPT_MODEL_URI?.trim()
  return Boolean(modelUri || folderId)
}

export function isOpenRouterConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim())
}

/** Провайдеры, для которых в `process.env` заданы обязательные креды. */
export function getConfiguredAIProviderIds(): AIProviderId[] {
  const flags: Record<AIProviderId, boolean> = {
    deepseek: isDeepseekConfigured(),
    gigachat: isGigaChatConfigured(),
    yandexgpt: isYandexGptConfigured(),
    openrouter: isOpenRouterConfigured(),
  }
  return AI_PROVIDER_ID_VALUES.filter((id) => flags[id])
}

/**
 * Предпочтительный дефолт из `AI_DEFAULT_PROVIDER`, если он реально настроен; иначе первый из списка.
 */
export function pickDefaultProviderForUi(
  preferred: AIProviderId,
  available: readonly AIProviderId[]
): AIProviderId | null {
  if (available.length === 0) return null
  if (available.includes(preferred)) return preferred
  return available[0] ?? null
}

/** Дефолт для Zod/нормализации: не указывает несуществующий в env провайдер, если есть альтернативы. */
export function resolveEffectiveDefaultProvider(): AIProviderId {
  const available = getConfiguredAIProviderIds()
  const preferred = resolveConfiguredDefaultProviderId()
  const picked = pickDefaultProviderForUi(preferred, available)
  return picked ?? preferred
}
