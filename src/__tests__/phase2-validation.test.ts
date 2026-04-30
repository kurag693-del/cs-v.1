import { describe, expect, it } from 'vitest'
import { CreateBrandSchema } from '@/lib/validation/brand'
import { MediaUrlsSchema } from '@/lib/validation/media'

describe('phase 2 validation hardening', () => {
  it('accepts brand payload with valid JSON examples', () => {
    const parsed = CreateBrandSchema.safeParse({
      name: 'Creative Studio',
      tone: 'дружелюбный экспертный',
      examples: '["Кейс 1", "Кейс 2"]',
      colors: ['#112233'],
    })

    expect(parsed.success).toBe(true)
  })

  it('accepts valid media url list', () => {
    const parsed = MediaUrlsSchema.safeParse([
      'https://cdn.example.com/one.jpg',
      'https://cdn.example.com/two.webp',
    ])

    expect(parsed.success).toBe(true)
  })

  it('rejects media list when url is invalid', () => {
    const parsed = MediaUrlsSchema.safeParse(['not-a-valid-url'])

    expect(parsed.success).toBe(false)
  })

  it('rejects media list when item count exceeds limit', () => {
    const parsed = MediaUrlsSchema.safeParse(Array.from({ length: 11 }, (_, index) => `https://cdn.example.com/${index}.jpg`))

    expect(parsed.success).toBe(false)
  })

  it('rejects brand examples when not JSON array', () => {
    const parsed = CreateBrandSchema.safeParse({
      name: 'Creative Studio',
      tone: 'дружелюбный',
      examples: '{"example":"single-object"}',
    })

    expect(parsed.success).toBe(false)
  })
})
