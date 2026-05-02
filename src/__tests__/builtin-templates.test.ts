import { describe, expect, it } from 'vitest'

import {
  BUILTIN_TEMPLATES,
  getBuiltinTemplateById,
  validateBuiltinTemplatesCatalog,
} from '@/lib/templates/builtin-templates'

describe('builtin templates catalog', () => {
  it('passes structural validation without throwing', () => {
    expect(() => validateBuiltinTemplatesCatalog()).not.toThrow()
  })

  it('has unique ids and each entry resolves by id', () => {
    const ids = BUILTIN_TEMPLATES.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)

    for (const t of BUILTIN_TEMPLATES) {
      expect(getBuiltinTemplateById(t.id)?.id).toBe(t.id)
    }
    expect(getBuiltinTemplateById('unknown')).toBeNull()
  })

  it('each template has at least one suggested platform', () => {
    for (const t of BUILTIN_TEMPLATES) {
      expect(t.suggestedPlatforms.length).toBeGreaterThan(0)
    }
  })

  it('merges base catalog and JSON sphere scenarios', () => {
    expect(BUILTIN_TEMPLATES.length).toBeGreaterThanOrEqual(30)
    const ids = BUILTIN_TEMPLATES.map((t) => t.id)
    expect(ids).toContain('it-b2b')
    expect(ids).toContain('real-estate')
    expect(ids).toContain('it-startup__case-study')
    expect(ids).toContain('coffee-shop__new-menu-item')
    expect(ids).toContain('online-education__free-lesson')
  })
})
