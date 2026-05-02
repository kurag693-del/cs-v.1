import { describe, expect, it } from 'vitest'

import { getApprovalStatus, setApprovalStatus } from '@/lib/approval/workflow'
import { canTransitionPostStatus } from '@/lib/publish/state-machine'

/**
 * Документирует ту же цепочку проверок, что и schedulePost (без БД и сессии):
 * статус DRAFT → SCHEDULED с датой в будущем и approval APPROVED.
 */
describe('draft → scheduled gate chain (schedulePost logic)', () => {
  it('requires APPROVED metadata before scheduling', () => {
    expect(getApprovalStatus({})).toBe('DRAFT')

    const pending = setApprovalStatus({}, { nextStatus: 'REVIEW_PENDING', userId: 'u1' })
    expect(getApprovalStatus(pending)).toBe('REVIEW_PENDING')

    const approved = setApprovalStatus(pending, { nextStatus: 'APPROVED', userId: 'admin' })
    expect(getApprovalStatus(approved)).toBe('APPROVED')
  })

  it('allows DRAFT → SCHEDULED when scheduledAt is in the future', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    const future = new Date('2026-01-20T12:00:00Z')
    const t = canTransitionPostStatus('DRAFT', 'SCHEDULED', { scheduledAt: future, now })
    expect(t.valid).toBe(true)
  })

  it('rejects scheduling in the past', () => {
    const now = new Date('2026-01-15T12:00:00Z')
    const past = new Date('2026-01-10T12:00:00Z')
    const t = canTransitionPostStatus('DRAFT', 'SCHEDULED', { scheduledAt: past, now })
    expect(t.valid).toBe(false)
    if (!t.valid) expect(t.code).toBe('SCHEDULE_IN_PAST')
  })
})
