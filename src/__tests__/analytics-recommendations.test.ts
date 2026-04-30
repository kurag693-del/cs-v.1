import { describe, expect, it } from 'vitest'

import { buildRecommendations } from '@/lib/analytics/recommendations'

describe('analytics recommendations', () => {
  it('returns deterministic best hour and platform', () => {
    const input = {
      byHour: { '09:00': 1, '11:00': 3, '18:00': 2 },
      byPlatform: { TELEGRAM: 4, VK: 2 },
      totalPublished: 6,
    }

    const first = buildRecommendations(input)
    const second = buildRecommendations(input)

    expect(first.bestHour).toBe('11:00')
    expect(first.bestPlatform).toBe('TELEGRAM')
    expect(second).toEqual(first)
  })

  it('adds bootstrap suggestion for low data', () => {
    const result = buildRecommendations({
      byHour: {},
      byPlatform: {},
      totalPublished: 1,
    })

    expect(result.bestHour).toBe('09:00')
    expect(result.bestPlatform).toBe('TELEGRAM')
    expect(result.suggestions[0]).toContain('минимум 3 публикации')
  })
})
