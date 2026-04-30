import { describe, expect, it } from 'vitest'

import { getBestPublishingTime, getPlatformPerformance } from '@/lib/analytics/metrics'

describe('analytics metrics', () => {
  it('calculates best publishing time from fixtures', () => {
    const best = getBestPublishingTime([
      { platform: 'TELEGRAM', status: 'PUBLISHED', publishedAt: new Date(2026, 0, 1, 9, 20, 0) },
      { platform: 'TELEGRAM', status: 'PUBLISHED', publishedAt: new Date(2026, 0, 2, 9, 40, 0) },
      { platform: 'VK', status: 'PUBLISHED', publishedAt: new Date(2026, 0, 2, 11, 10, 0) },
    ])
    expect(best).toBe('09:00')
  })

  it('builds platform performance with shares', () => {
    const performance = getPlatformPerformance([
      { platform: 'TELEGRAM', status: 'PUBLISHED', publishedAt: new Date(2026, 0, 1, 9, 20, 0) },
      { platform: 'TELEGRAM', status: 'PUBLISHED', publishedAt: new Date(2026, 0, 2, 9, 40, 0) },
      { platform: 'VK', status: 'PUBLISHED', publishedAt: new Date(2026, 0, 2, 11, 10, 0) },
      { platform: 'VK', status: 'DRAFT', publishedAt: null },
    ])
    expect(performance[0]).toEqual({ platform: 'TELEGRAM', count: 2, share: 67 })
    expect(performance[1]).toEqual({ platform: 'VK', count: 1, share: 33 })
  })
})
