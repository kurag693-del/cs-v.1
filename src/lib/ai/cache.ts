import type { AIResponse } from './types'

const responseCache = new Map<string, { data: AIResponse; timestamp: number }>()
const CACHE_DURATION = 1000 * 60 * 5 // 5 minutes

export async function getCachedResponse(key: string): Promise<AIResponse | null> {
  const cached = responseCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }
  if (cached) {
    responseCache.delete(key)
  }
  return null
}

export async function setCachedResponse(key: string, data: AIResponse): Promise<void> {
  responseCache.set(key, { data, timestamp: Date.now() })
}

export async function clearCache(): Promise<void> {
  responseCache.clear()
}
