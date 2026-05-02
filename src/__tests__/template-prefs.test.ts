import { describe, expect, it } from 'vitest'

import {
  normalizeFavoriteTemplateIds,
  parseTemplatePrefsFromProfile,
  toggleFavoriteInList,
} from '@/lib/templates/template-prefs'

describe('template-prefs', () => {
  it('parses nested templatePrefs from profile JSON', () => {
    expect(parseTemplatePrefsFromProfile(null)).toEqual({})
    expect(parseTemplatePrefsFromProfile({ templatePrefs: { favoriteBuiltinTemplateIds: ['a', 'b'] } })).toEqual({
      favoriteBuiltinTemplateIds: ['a', 'b'],
    })
  })

  it('normalizes favorites: unique, capped', () => {
    expect(normalizeFavoriteTemplateIds(['x', 'x', 'y'])).toEqual(['x', 'y'])
  })

  it('toggleFavoriteInList adds and removes', () => {
    const a = toggleFavoriteInList([], 't1')
    expect(a.next).toEqual(['t1'])
    const b = toggleFavoriteInList(a.next, 't1')
    expect(b.next).toEqual([])
  })
})

describe('filter and order templates', () => {
  it('filter by category and search', async () => {
    const { BUILTIN_TEMPLATES, filterBuiltinTemplates } = await import('@/lib/templates/builtin-templates')
    const all = BUILTIN_TEMPLATES.length
    expect(all).toBeGreaterThanOrEqual(30)
    const horeca = filterBuiltinTemplates({ category: 'horeca', search: '' })
    expect(horeca.every((t) => t.category === 'horeca')).toBe(true)
    const q = filterBuiltinTemplates({ category: 'all', search: 'коф' })
    expect(q.length).toBeGreaterThan(0)
  })

  it('order puts preferred and favorites first', async () => {
    const { BUILTIN_TEMPLATES, orderBuiltinTemplatesForUi } = await import('@/lib/templates/builtin-templates')
    const list = BUILTIN_TEMPLATES.slice(0, 3)
    const first = list[0]!
    const second = list[1]!
    const ordered = orderBuiltinTemplatesForUi(list, [second.id], first.id)
    expect(ordered[0]!.id).toBe(first.id)
    expect(ordered[1]!.id).toBe(second.id)
  })
})
