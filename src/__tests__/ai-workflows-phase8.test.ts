import { describe, expect, it } from 'vitest'

import { buildAbVariants } from '@/lib/ai/workflows/ab-variants'
import { generateAutoHashtags } from '@/lib/ai/workflows/hashtags'
import { recycleContentForPlatforms } from '@/lib/ai/workflows/recycle'

describe('phase 8 ai workflows', () => {
  it('builds deterministic A/B/C variants', () => {
    const base = 'Хук\n\nТело поста\n\n#контент\n\nНапишите комментарий'
    const variants = buildAbVariants(base, 3)

    expect(variants).toHaveLength(3)
    expect(variants[0]?.id).toBe('A')
    expect(variants[1]?.content).toContain('Практически:')
    expect(variants[2]?.content).toContain('Вдохновляюще:')
  })

  it('generates auto hashtags with platform tag', () => {
    const hashtags = generateAutoHashtags(
      'Маркетинг стратегия контент план бренд стратегия контент воронка',
      'Telegram'
    )

    expect(hashtags[0]).toBe('#telegram')
    expect(hashtags.length).toBeGreaterThan(1)
    expect(hashtags.every((tag) => tag.startsWith('#'))).toBe(true)
  })

  it('recycles one post for multiple platforms', () => {
    const recycled = recycleContentForPlatforms('Базовый пост про контент-стратегию', ['Telegram', 'VK', 'Dzen'])

    expect(recycled).toHaveLength(3)
    expect(recycled.map((item) => item.platform)).toEqual(['Telegram', 'VK', 'Dzen'])
    expect(recycled[0]?.content).toContain('Telegram-версия')
    expect(recycled[1]?.content).toContain('VK-версия')
    expect(recycled[2]?.content).toContain('Dzen-версия')
  })
})
