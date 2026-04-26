import type { SubscriptionTier } from '@prisma/client'

export interface AIServiceConfig {
  provider: 'openrouter' | 'openai' | 'anthropic' | 'gemini' | 'liteLLM'
  apiKey: string
  baseURL?: string
  defaultModel?: string
  maxRetries?: number
  timeout?: number
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUSD?: number
}

export interface AICostTracking {
  tokenUsage: TokenUsage
  cost: number
  model: string
  timestamp: Date
}

export interface AIResponse {
  id: string
  content: string
  usage: TokenUsage
  model: string
  timestamp: Date
  choices?: Array<{
    index: number
    message: {
      role: 'assistant' | 'user' | 'system'
      content: string
    }
    finish_reason: string | null
  }>
  moderation?: ModerationResult
}

export interface ModerationResult {
  isApproved: boolean
  categories: string[]
  severity: 'low' | 'medium' | 'high' | 'critical'
  reason: string
  flags: string[]
}

export type GenerationTask = 
  | 'social_post'
  | 'blog_outline'
  | 'ad_copy'
  | 'image_prompt'
  | 'feedback_optimizer'
  | 'brand_voice'

export interface GenerationInput {
  type: GenerationTask
  prompt: string
  model?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
  metadata?: Record<string, any>
}

export interface UserCredits {
  userId: string
  tier: SubscriptionTier
  credits: number
  monthlyLimit: number
  resetDate: Date
}

export interface CreditTransaction {
  id: string
  userId: string
  amount: number
  type: 'debit' | 'credit'
  description: string
  generationId?: string
  createdAt: Date
}

export interface GenerationResult {
  success: boolean
  data?: {
    generationId: string
    content: string
    model: string
    tokens: TokenUsage
    costUSD: number
  }
  error?: string
  code?: string
}
