import { describe, expect, it } from 'vitest'

import { generateInviteSecret, hashInviteToken } from '@/lib/workspace/invite-token'

describe('workspace invite token', () => {
  it('hash is stable for same token and distinct for different', () => {
    const a = hashInviteToken('one-test-token-123456789012')
    const b = hashInviteToken('one-test-token-123456789012')
    const c = hashInviteToken('other-test-token-12345678901')
    expect(a).toBe(b)
    expect(a).not.toBe(c)
    expect(a).toMatch(/^[a-f0-9]{64}$/)
  })

  it('generate produces unique raw tokens and matching hash', () => {
    const x = generateInviteSecret()
    const y = generateInviteSecret()
    expect(x.rawToken).not.toBe(y.rawToken)
    expect(x.tokenHash).toBe(hashInviteToken(x.rawToken))
  })
})
