import { type ContentStatus } from '@prisma/client'

export type PostWorkflowStatus = ContentStatus | 'FAILED'

const ALLOWED_TRANSITIONS: Readonly<Record<ContentStatus, readonly ContentStatus[]>> = {
  DRAFT: ['SCHEDULED', 'ARCHIVED'],
  SCHEDULED: ['DRAFT', 'PUBLISHED', 'FAILED', 'ARCHIVED'],
  PUBLISHED: ['ARCHIVED'],
  FAILED: ['DRAFT', 'SCHEDULED', 'ARCHIVED'],
  ARCHIVED: [],
}

type TransitionContext = {
  scheduledAt?: Date | null
  now?: Date
}

export type TransitionResult =
  | { valid: true }
  | {
      valid: false
      code: 'INVALID_TRANSITION' | 'SCHEDULE_IN_PAST' | 'PUBLISH_BEFORE_SCHEDULE'
      message: string
    }

export function canTransitionPostStatus(
  currentStatus: PostWorkflowStatus,
  nextStatus: PostWorkflowStatus,
  context: TransitionContext = {}
): TransitionResult {
  if (currentStatus === nextStatus) {
    return { valid: true }
  }

  const allowedTargets = ALLOWED_TRANSITIONS[currentStatus] ?? []
  if (!allowedTargets.includes(nextStatus)) {
    return {
      valid: false,
      code: 'INVALID_TRANSITION',
      message: `Нельзя перейти из "${currentStatus}" в "${nextStatus}"`,
    }
  }

  const now = context.now ?? new Date()
  const scheduledAt = context.scheduledAt ?? null

  if (nextStatus === 'SCHEDULED') {
    if (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt <= now) {
      return {
        valid: false,
        code: 'SCHEDULE_IN_PAST',
        message: 'Дата публикации должна быть в будущем',
      }
    }
  }

  if (nextStatus === 'PUBLISHED' && scheduledAt && scheduledAt > now) {
    return {
      valid: false,
      code: 'PUBLISH_BEFORE_SCHEDULE',
      message: 'Нельзя опубликовать пост раньше запланированного времени',
    }
  }

  return { valid: true }
}
