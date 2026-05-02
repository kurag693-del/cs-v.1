import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getOpenRouterImageModelOptions,
  getOpenRouterTextModelOptions,
  isOpenRouterTextModelAllowed,
} from '@/lib/ai/model-catalog'

describe('model-catalog env tiers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('FREE tier only exposes free slugs for text', () => {
    vi.stubEnv('AI_TEXT_MODELS_FREE', 'a/free-one,a/free-two')
    vi.stubEnv('AI_TEXT_MODELS_PAID', 'z/paid-one,z/paid-two')
    expect(getOpenRouterTextModelOptions('FREE').map((x) => x.slug)).toEqual(['a/free-one', 'a/free-two'])
    expect(isOpenRouterTextModelAllowed('z/paid-one', 'FREE')).toBe(false)
    expect(isOpenRouterTextModelAllowed('a/free-one', 'FREE')).toBe(true)
  })

  it('PRO tier appends paid slugs in order after free text models', () => {
    vi.stubEnv('AI_TEXT_MODELS_FREE', 'f1,f2')
    vi.stubEnv('AI_TEXT_MODELS_PAID', 'p1,p2')
    expect(getOpenRouterTextModelOptions('PRO').map((x) => x.slug)).toEqual(['f1', 'f2', 'p1', 'p2'])
  })

  it('image options mirror text tier behavior', () => {
    vi.stubEnv('AI_IMAGE_MODELS_FREE', 'if1')
    vi.stubEnv('AI_IMAGE_MODELS_PAID', 'ip1')
    expect(getOpenRouterImageModelOptions('FREE').map((x) => x.slug)).toEqual(['if1'])
    expect(getOpenRouterImageModelOptions('ENTERPRISE').map((x) => x.slug)).toEqual(['if1', 'ip1'])
  })
})
