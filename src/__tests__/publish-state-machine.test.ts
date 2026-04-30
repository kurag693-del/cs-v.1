import { describe, expect, it } from 'vitest'

import { canTransitionPostStatus } from '@/lib/publish/state-machine'

describe('publish state machine', () => {
  it('allows valid transition from draft to scheduled with future date', () => {
    const now = new Date('2026-01-01T10:00:00.000Z')
    const scheduledAt = new Date('2026-01-01T11:00:00.000Z')

    const result = canTransitionPostStatus('DRAFT', 'SCHEDULED', { now, scheduledAt })
    expect(result).toEqual({ valid: true })
  })

  it('rejects scheduling in the past', () => {
    const now = new Date('2026-01-01T10:00:00.000Z')
    const scheduledAt = new Date('2026-01-01T09:00:00.000Z')

    const result = canTransitionPostStatus('DRAFT', 'SCHEDULED', { now, scheduledAt })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.code).toBe('SCHEDULE_IN_PAST')
    }
  })

  it('rejects invalid transition from published to draft', () => {
    const result = canTransitionPostStatus('PUBLISHED', 'DRAFT')
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.code).toBe('INVALID_TRANSITION')
    }
  })

  it('allows transition from scheduled to failed', () => {
    const result = canTransitionPostStatus('SCHEDULED', 'FAILED')
    expect(result).toEqual({ valid: true })
  })
})
