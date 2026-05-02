/** Single source of truth for provider IDs (Zod + registry). */
export const AI_PROVIDER_ID_VALUES = ['deepseek', 'gigachat', 'yandexgpt'] as const

export type AIProviderId = (typeof AI_PROVIDER_ID_VALUES)[number]

export interface AIProviderGenerateParams {
  prompt: string
  temperature: number
  maxTokens: number
}

export interface AIProviderGenerateResult {
  content: string
  model: string
  provider: AIProviderId
}

export interface AIProviderTokenEstimateParams {
  prompt: string
  maxTokens: number
}

export interface AIProvider {
  readonly id: AIProviderId
  generate(params: AIProviderGenerateParams): Promise<AIProviderGenerateResult>
  stream?(params: AIProviderGenerateParams): AsyncGenerator<string>
  estimateTokens(params: AIProviderTokenEstimateParams): number
}
