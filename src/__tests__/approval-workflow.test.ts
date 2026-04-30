import { describe, expect, it } from 'vitest'

import { canTransitionApprovalStatus, getApprovalStatus, setApprovalStatus } from '@/lib/approval/workflow'

describe('approval workflow', () => {
  it('returns DRAFT by default when metadata is empty', () => {
    expect(getApprovalStatus(null)).toBe('DRAFT')
    expect(getApprovalStatus({})).toBe('DRAFT')
  })

  it('validates approval transitions', () => {
    expect(canTransitionApprovalStatus('DRAFT', 'REVIEW_PENDING')).toBe(true)
    expect(canTransitionApprovalStatus('REVIEW_PENDING', 'APPROVED')).toBe(true)
    expect(canTransitionApprovalStatus('REVIEW_PENDING', 'REJECTED')).toBe(true)
    expect(canTransitionApprovalStatus('DRAFT', 'APPROVED')).toBe(false)
    expect(canTransitionApprovalStatus('APPROVED', 'REJECTED')).toBe(false)
  })

  it('writes approval metadata with actor and timestamp', () => {
    const updated = setApprovalStatus(
      { title: 'Post title' },
      { nextStatus: 'APPROVED', userId: 'user-1', note: 'Looks good' }
    )

    expect(updated.title).toBe('Post title')
    expect(getApprovalStatus(updated)).toBe('APPROVED')
    const approval = (updated as Record<string, unknown>).approval as Record<string, unknown>
    expect(approval.updatedBy).toBe('user-1')
    expect(approval.note).toBe('Looks good')
    expect(typeof approval.updatedAt).toBe('string')
  })
})
