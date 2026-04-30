type ApprovalStatus = 'DRAFT' | 'REVIEW_PENDING' | 'APPROVED' | 'REJECTED'

type ApprovalMeta = {
  status: ApprovalStatus
  note?: string
  updatedAt: string
  updatedBy: string
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

export function getApprovalStatus(metadata: unknown): ApprovalStatus {
  const root = asRecord(metadata)
  const approval = asRecord(root?.approval)
  const status = approval?.status
  if (status === 'REVIEW_PENDING' || status === 'APPROVED' || status === 'REJECTED' || status === 'DRAFT') {
    return status
  }
  return 'DRAFT'
}

export function canTransitionApprovalStatus(current: ApprovalStatus, next: ApprovalStatus): boolean {
  if (current === next) return true
  if (current === 'DRAFT') return next === 'REVIEW_PENDING'
  if (current === 'REVIEW_PENDING') return next === 'APPROVED' || next === 'REJECTED'
  if (current === 'REJECTED') return next === 'REVIEW_PENDING'
  if (current === 'APPROVED') return next === 'REVIEW_PENDING'
  return false
}

export function setApprovalStatus(
  metadata: unknown,
  input: { nextStatus: ApprovalStatus; userId: string; note?: string }
): Record<string, unknown> {
  const root = asRecord(metadata) ?? {}
  const approval: ApprovalMeta = {
    status: input.nextStatus,
    updatedAt: new Date().toISOString(),
    updatedBy: input.userId,
    ...(input.note ? { note: input.note } : {}),
  }

  return {
    ...root,
    approval,
  }
}

export type { ApprovalStatus }
