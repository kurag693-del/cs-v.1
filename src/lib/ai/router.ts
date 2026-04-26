import type { AIServiceConfig, AIResponse, TokenUsage } from './types'
import { calculateCost } from './utils'

export type GenerationTask =
  | 'social_post'
  | 'blog_outline'
  | 'ad_copy'
  | 'image_prompt'
  | 'feedback_optimizer'
  | 'brand_voice'

export type SubscriptionTier = 'FREE' | 'PRO' | 'ENTERPRISE'

export const MODEL_CONFIGS: Record<string, { input: number; output: number; maxTokens: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015, maxTokens: 4096 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006, maxTokens: 128000 },
  'gpt-4': { input: 0.03, output: 0.12, maxTokens: 8192 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015, maxTokens: 200000 },
  'gemini-1.5-pro': { input: 0.0035, output: 0.0105, maxTokens: 200000 },
}

export const TASK_MODELS: Record<GenerationTask, { primary: string; fallback: string[]; temp: number }> = {
  social_post: { primary: 'gpt-4o-mini', fallback: ['gpt-4o', 'claude-3-5-sonnet'], temp: 0.7 },
  blog_outline: { primary: 'gpt-4o-mini', fallback: ['gpt-4o', 'claude-3-5-sonnet'], temp: 0.5 },
  ad_copy: { primary: 'gpt-4o-mini', fallback: ['gpt-4o', 'gemini-1.5-pro'], temp: 0.6 },
  image_prompt: { primary: 'gpt-4o-mini', fallback: ['gpt-4o', 'claude-3-5-sonnet'], temp: 0.4 },
  feedback_optimizer: { primary: 'gpt-4o-mini', fallback: ['gpt-4o', 'claude-3-5-sonnet'], temp: 0.3 },
  brand_voice: { primary: 'gpt-4o-mini', fallback: ['gpt-4o', 'claude-3-5-sonnet'], temp: 0.5 },
}

export const TIER_LIMITS: Record<SubscriptionTier, { maxTokensPerRequest: number; maxCostPerRequest: number }> = {
  FREE: { maxTokensPerRequest: 2000, maxCostPerRequest: 0.01 },
  PRO: { maxTokensPerRequest: 8000, maxCostPerRequest: 0.05 },
  ENTERPRISE: { maxTokensPerRequest: 32000, maxCostPerRequest: 0.20 },
}

export interface RouteDecision {
  model: string
  temperature: number
  maxTokens: number
  estimatedCost: number
  tier: SubscriptionTier
  warnings: string[]
}

export function routeModel(task: GenerationTask, tier: SubscriptionTier): RouteDecision {
  const taskConfig = TASK_MODELS[task]
  const tierLimits = TIER_LIMITS[tier]
  const warnings: string[] = []

  let selectedModel = taskConfig.primary
  const modelInfo = MODEL_CONFIGS[selectedModel]

  // Check tier limits
  if (modelInfo.maxTokens > tierLimits.maxTokensPerRequest) {
    warnings.push(`Model ${selectedModel} exceeds tier token limit, using fallback`)
    const fallback = taskConfig.fallback.find(m => MODEL_CONFIGS[m].maxTokens <= tierLimits.maxTokensPerRequest)
    if (fallback) {
      selectedModel = fallback
    }
  }

  // Estimate cost (assuming ~500 tokens prompt + 1000 tokens completion)
  const estimatedPromptTokens = 500
  const estimatedCompletionTokens = Math.min(1000, tierLimits.maxTokensPerRequest)
  const estimatedCost = calculateCost(estimatedPromptTokens + estimatedCompletionTokens, selectedModel)

  if (estimatedCost > tierLimits.maxCostPerRequest) {
    warnings.push(`Estimated cost $${estimatedCost.toFixed(4)} exceeds tier limit, using cheaper model`)
    const cheaperFallback = taskConfig.fallback
      .concat([taskConfig.primary])
      .find(m => {
        const cost = calculateCost(estimatedPromptTokens + estimatedCompletionTokens, m)
        return cost <= tierLimits.maxCostPerRequest
      })
    if (cheaperFallback) {
      selectedModel = cheaperFallback
    }
  }

  const finalModelInfo = MODEL_CONFIGS[selectedModel]

  return {
    model: selectedModel,
    temperature: taskConfig.temp,
    maxTokens: Math.min(1000, finalModelInfo.maxTokens, tierLimits.maxTokensPerRequest),
    estimatedCost,
    tier,
    warnings,
  }
}
