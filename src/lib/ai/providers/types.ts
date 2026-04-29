export type AIProviderId = 'gigachat' | 'yandexgpt' | 'vkai'

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
