import { describe, expect, it } from 'vitest'

import { resolveAccessDecision } from '@/lib/auth/middleware-routes'

describe('middleware access rules', () => {
  it('allows public pages without session', () => {
    expect(resolveAccessDecision('/login', false)).toBe('allow')
    expect(resolveAccessDecision('/pricing', false)).toBe('allow')
    expect(resolveAccessDecision('/api/health', false)).toBe('allow')
  })

  it('redirects protected routes without session', () => {
    expect(resolveAccessDecision('/dashboard', false)).toBe('redirect_login')
    expect(resolveAccessDecision('/dashboard/calendar', false)).toBe('redirect_login')
    expect(resolveAccessDecision('/onboarding', false)).toBe('redirect_login')
  })

  it('allows protected routes with session', () => {
    expect(resolveAccessDecision('/dashboard', true)).toBe('allow')
    expect(resolveAccessDecision('/onboarding', true)).toBe('allow')
  })
})
