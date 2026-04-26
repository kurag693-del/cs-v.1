import type { TokenUsage, AICostTracking } from './types'

const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4': { input: 0.03, output: 0.12 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'gemini-1.5-pro': { input: 0.0035, output: 0.0105 },
}

export function calculateCost(tokenCount: number, model: string): number {
  const pricing = COST_PER_1K_TOKENS[model] || COST_PER_1K_TOKENS['gpt-4o-mini']
  return (tokenCount / 1000) * (pricing.input + pricing.output) / 2
}

const usageHistory: AICostTracking[] = []

export function trackTokenUsage(usage: TokenUsage, cost: number): void {
  usageHistory.push({
    tokenUsage: usage,
    cost,
    model: 'unknown',
    timestamp: new Date(),
  })
}

export function getTotalCost(): number {
  return usageHistory.reduce((sum, entry) => sum + entry.cost, 0)
}

export function getUsageHistory(): AICostTracking[] {
  return [...usageHistory]
}

export function clearUsageHistory(): void {
  usageHistory.length = 0
}

// Simple in-memory cache
const responseCache = new Map<string, { data: any; timestamp: number }>()
const CACHE_DURATION = 1000 * 60 * 5 // 5 minutes

export async function getCachedResponse(key: string) {
  const cached = responseCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  if (cached) {
    responseCache.delete(key)
  }
  return null
}

export async function setCachedResponse(key: string, data: any): Promise<void> {
  responseCache.set(key, { data, timestamp: Date.now() })
}

export async function clearCache(): Promise<void> {
  responseCache.clear()
}