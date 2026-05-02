import { describe, expect, it } from 'vitest'

import { generateMockImageDataUrl } from '@/lib/ai/image/image-gen/mock-provider'

describe('mock image gen', () => {
  it('returns stable hash id for same prompt and data url', () => {
    const a = generateMockImageDataUrl('кофе на рассвете', 256)
    const b = generateMockImageDataUrl('кофе на рассвете', 256)
    expect(a.imageUrl).toBe(b.imageUrl)
    expect(a.imageUrl.startsWith('data:image/svg+xml')).toBe(true)
    expect(a.backend).toBe('mock')
  })
})
