import { describe, expect, it } from 'vitest'

import { inlineMediaForProxyPayload, parseFirstMediaUrl } from '@/lib/publish/parse-media-url'

describe('parseFirstMediaUrl', () => {
  it('parses https', () => {
    const p = parseFirstMediaUrl(['https://x.com/a.png'])
    expect(p).toEqual({ kind: 'remote', url: 'https://x.com/a.png' })
  })

  it('parses base64 data png', () => {
    const b64 = Buffer.from([0, 1, 2, 3]).toString('base64')
    const u = `data:image/png;base64,${b64}`
    const p = parseFirstMediaUrl([u])
    expect(p.kind).toBe('data')
    if (p.kind === 'data') {
      expect(p.mimeType).toBe('image/png')
      expect(p.buffer.length).toBeGreaterThan(0)
    }
  })

  it('inline for proxy only under size cap', () => {
    const tiny = parseFirstMediaUrl(['data:image/png;base64,' + Buffer.alloc(100).toString('base64')])
    expect(inlineMediaForProxyPayload(tiny)).toBeDefined()
  })
})
