import { type Platform } from '@prisma/client'

export type RecommendationInput = {
  byHour: Record<string, number>
  byPlatform: Record<string, number>
  totalPublished: number
}

export type RecommendationResult = {
  bestHour: string
  bestPlatform: string
  suggestions: string[]
}

function topKey(map: Record<string, number>, fallback: string): string {
  const winner = Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0]
  return winner ?? fallback
}

export function buildRecommendations(input: RecommendationInput): RecommendationResult {
  const bestHour = topKey(input.byHour, '09:00')
  const bestPlatform = topKey(input.byPlatform, 'TELEGRAM')
  const suggestions: string[] = []

  if (input.totalPublished < 3) {
    suggestions.push('Сначала наберите минимум 3 публикации, чтобы рекомендации стали точнее.')
  }

  suggestions.push(`Публикуйте основной контент в ${bestHour}: исторически этот слот показывает лучший результат.`)
  suggestions.push(`Сфокусируйте 60-70% объема на платформе ${bestPlatform}, остальное используйте для тестов.`)

  if ((input.byPlatform.VK ?? 0) === 0) {
    suggestions.push('Добавьте минимум 1-2 тестовые публикации в VK, чтобы сравнить эффективность каналов.')
  }

  return {
    bestHour,
    bestPlatform,
    suggestions,
  }
}

export function normalizePlatformName(platform: string): Platform | string {
  const allowed: Platform[] = ['TELEGRAM', 'VK', 'DZEN', 'TWITTER', 'LINKEDIN', 'FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'YOUTUBE']
  return allowed.includes(platform as Platform) ? (platform as Platform) : platform
}
