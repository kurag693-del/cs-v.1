import { describe, expect, it } from 'vitest'

import { getEditorsCanPublishFromSettings, mergeWorkspaceSettings } from '@/lib/workspace/workspace-settings'

describe('workspace publish settings', () => {
  it('defaults editorsCanPublish to true when settings absent (совместимость)', () => {
    expect(getEditorsCanPublishFromSettings(null)).toBe(true)
    expect(getEditorsCanPublishFromSettings(undefined)).toBe(true)
    expect(getEditorsCanPublishFromSettings({})).toBe(true)
  })

  it('respects explicit editorsCanPublish', () => {
    expect(getEditorsCanPublishFromSettings({ editorsCanPublish: false })).toBe(false)
    expect(getEditorsCanPublishFromSettings({ editorsCanPublish: true })).toBe(true)
  })

  it('mergeWorkspaceSettings preserves other keys', () => {
    const prev = { editorsCanPublish: true, futureFlag: 1 }
    const merged = mergeWorkspaceSettings(prev, { editorsCanPublish: false })
    expect(merged.editorsCanPublish).toBe(false)
    expect(merged.futureFlag).toBe(1)
  })
})
