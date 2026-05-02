import { describe, expect, it } from 'vitest'
import { simplifyAspectRatio } from '@/lib/ai/image/image-gen/yandex-art-gen'

describe('YandexART helpers', () => {
  it('simplifyAspectRatio reduces to smallest integers', () => {
    expect(simplifyAspectRatio(512, 512)).toEqual({ widthRatio: '1', heightRatio: '1' })
    expect(simplifyAspectRatio(1024, 512)).toEqual({ widthRatio: '2', heightRatio: '1' })
    expect(simplifyAspectRatio(1024, 768)).toEqual({ widthRatio: '4', heightRatio: '3' })
  })
})
