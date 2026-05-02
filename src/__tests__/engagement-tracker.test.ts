import { describe, expect, it } from 'vitest'

import { parseVkCompositePostId } from '@/lib/analytics/engagement-tracker'
import { postEngagementSnapshotSchema } from '@/lib/analytics/engagement-types'

describe('engagement tracker', () => {
  it('parses VK composite post id', () => {
    expect(parseVkCompositePostId('-123_456')).toEqual({ ownerId: '-123', postId: '456' })
    expect(parseVkCompositePostId('123_789')).toEqual({ ownerId: '123', postId: '789' })
    expect(parseVkCompositePostId('nope')).toBeNull()
  })

  it('validates engagement snapshot', () => {
    const s = {
      source: 'vk' as const,
      fetchedAt: new Date().toISOString(),
      views: 10,
      likes: 2,
    }
    expect(postEngagementSnapshotSchema.safeParse(s).success).toBe(true)
  })
})
